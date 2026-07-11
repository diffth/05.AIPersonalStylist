interface Env {
  GEMINI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8"
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { image, height, weight, city } = await request.json<{ image: string; height: number; weight: number; city?: string }>();

    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: "Cloudflare 환경변수(GEMINI_API_KEY)가 구성되지 않았습니다. Variables and Secrets 설정을 확인해 주세요." } }), {
        status: 500,
        headers: corsHeaders
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

    const cityText = city ? `\n- 사용자가 위치한 도시: ${city} (이 도시의 지리적 위치, 기후 특성, 계절적인 스타일링 요소를 스타일 팁에 위트 있게 살짝 녹여 주세요)` : '';

    const prompt = `당신은 전문 퍼스널 스타일리스트입니다.
사용자의 사진과 신체정보(키: ${height}cm, 몸무게: ${weight}kg, 계산된 BMI: ${bmi}${cityText})를 분석하여 맞춤형 스타일 컨설팅 보고서를 작성해주세요.

보고서에는 다음 내용을 포함시켜주세요.
1. 체형분석 (bodyType & bodyAnalysis)
   - bodyType: 사진과 신체 수치를 기반으로 감정한 사용자의 구체적인 체형 타입 (예: 모래시계형, 삼각형, 직사각형, 역삼각형, 둥근형 등)
   - bodyAnalysis: 골격 형태와 비율 특징에 대한 전문적인 체형 분석 설명 (200자 내외)
2. 퍼스널 컬러 추천 (bestColors & personalColorTips)
   - bestColors: 가장 조화롭고 잘 어울리는 대표 퍼스널 컬러 색상 3가지를 담은 배열
   - personalColorTips: 선정된 컬러 톤을 실생활 코디에 어떻게 조화롭게 접목할지에 대한 퍼스널 컬러 스타일링 팁 (200자 내외)
3. 어울리는 스타일 및 패션 아이템 추천 (recommendations & recommendedItems)
   - recommendations: 추천 스타일 무드를 직관적으로 나타내는 해시태그 3가지를 담은 배열
   - recommendedItems: 해당 체형의 매력을 극대화하거나 단점을 멋지게 보완할 수 있는 구체적인 옷 종류 및 패션 아이템 추천 목록 (150자 내외)
4. 피해야 할 스타일 (avoidStyles)
   - avoidStyles: 체형 보완을 위해 가급적 매치를 지양하거나 피해야 하는 실루엣, 옷의 패턴, 특정 디자인 디테일 설명 (200자 내외)
5. 코디 팁 (styleTips)
   - styleTips: 일상에서 바로 적용하기 유용하며 스타일지수를 높여줄 실용적이고 센스 있는 구체적인 코디 팁 (200자 내외)

친절하고 전문적인 톤으로 작성해주세요.

반드시 아래 제공된 JSON 형식의 스키마로만 응답해야 하며, 그 외의 다른 불필요한 설명 텍스트나 마크다운 코드 블록 표시(\`\`\`json)는 절대 결과에 포함하지 마십시오. 오직 바로 파싱 가능한 유효한 JSON 문자열만 반환해야 합니다.

JSON 구조 예시:
{
  "bodyType": "슬림하고 어깨가 돋보이는 역삼각형 체형",
  "bodyAnalysis": "상체에 비해 하체가 슬림한 편이며 어깨선이 발달되어 세련되고 시크한 분위기를 자아냅니다. 상하체의 시각적 균형을 잡아주는 것이 스타일링의 포인트입니다.",
  "bestColors": ["로즈 베이지", "차콜 그레이", "올리브 그린"],
  "personalColorTips": "차분한 올리브 그린과 차콜 그레이로 지적인 무드를 연출하고, 밝은 로즈 베이지를 이너나 포인트 아이템으로 활용해 얼굴빛을 한층 환하게 켜주세요.",
  "recommendations": ["#어깨포인트", "#A라인코디", "#페미닌캐주얼"],
  "recommendedItems": "와이드 핏 데님 슬랙스, A라인 플레어 스커트, 네크라인이 깊게 파인 브이넥 니트, 드롭 숄더 재킷",
  "avoidStyles": "어깨패드가 과도하게 강조된 재킷이나 목을 꽉 덮는 터틀넥, 상체에 화려한 프릴이 가득한 디테일은 피하시는 것이 좋습니다.",
  "styleTips": "어깨 라인의 세련됨을 살리기 위해 깊은 브이넥이나 스퀘어넥 상의를 입고, 하의는 풍성한 A라인 스커트를 매치해 모래시계 실루엣을 완성하는 센스를 발휘해보세요."
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
        headers: corsHeaders
      });
    }

    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: corsHeaders
    });
  }
};
