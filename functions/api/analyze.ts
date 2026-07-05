interface Env {
  GEMINI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { image, height, weight } = await request.json<{ image: string; height: number; weight: number }>();

    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: "Cloudflare 환경변수(GEMINI_API_KEY)가 구성되지 않았습니다. Variables and Secrets 설정을 확인해 주세요." } }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 이미지 Base64 데이터 추출
    const commaIndex = image.indexOf(',');
    const base64DataOnly = image.substring(commaIndex + 1);
    const mimeTypeMatch = image.match(/data:([^;]+);base64/);
    const imageMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    const heightInMeters = height / 100;
    const bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));

    // 구글 Gemini 3.1 Flash Lite API 엔드포인트 및 프롬프트 정의
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `당신은 세계적인 패션 디자이너이자 개인 스타일리스트, 체형 분석 전문가입니다. 
제공된 사용자의 사진과 다음 입력 정보(키: ${height}cm, 몸무게: ${weight}kg, 계산된 BMI: ${bmi})를 기반으로, 사용자의 골격과 체형 실루엣을 전문적으로 분석하고 맞춤형 코디 제안을 해주세요.

분석 기준:
1. 사용자의 사진에서 실루엣과 바디라인을 감정하여 적절한 체형 타입(예: 모래시계형, 삼각형, 직사각형, 역삼각형, 둥근형 등)을 결정하세요.
2. 분석 결과를 바탕으로, 체형의 장점은 돋보이게 하고 단점은 커버할 수 있는 매력적인 코디 스타일 팁을 친절하고 자세한 한글 텍스트로 작성해 주세요. (250자 내외)
3. 해당 체형에 가장 잘 어울릴 스타일 해시태그 3가지를 뽑아내세요.
4. 사용자에게 가장 조화롭게 추천될 대표적인 퍼스널 컬러/색상 톤 3가지를 선정하세요.

반드시 아래 제공된 JSON 형식의 스키마로만 응답해야 하며, 그 외의 다른 불필요한 설명 텍스트나 마크다운 코드 블록 표시(\`\`\`json)는 절대 결과에 포함하지 마십시오. 오직 바로 파싱 가능한 유효한 JSON 문자열만 반환해야 합니다.

JSON 구조 예시:
{
  "bodyType": "슬림하고 어깨가 돋보이는 역삼각형 체형",
  "styleTips": "어깨 라인의 세련됨을 강조하면서도, 하의에 와이드 팬츠나 A라인 스커트를 매치해 하체 볼륨감을 조화롭게 연출하는 코디를 추천합니다. 부드러운 드레이프 소재의 상의를 선택하면 한결 우아하고 고급스러운 실루엣을 연출할 수 있습니다.",
  "recommendations": ["#어깨포인트", "#A라인코디", "#페미닌캐주얼"],
  "bestColors": ["로즈 베이지", "차콜 그레이", "올리브 그린"]
}
`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageMimeType,
                  data: base64DataOnly
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
};
