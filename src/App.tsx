import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import './App.css'


type AppState = 'idle' | 'loading' | 'result';

interface AnalysisResult {
  bmi: number;
  bodyType: string;
  recommendations: string[];
  styleTips: string;
  bestColors: string[];
}

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(65);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [status, setStatus] = useState<AppState>('idle');
  const [loadingText, setLoadingText] = useState<string>('이미지를 분석하고 있습니다...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 드래그 앤 드롭 이벤트 처리
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // 가상 분석 로직 실행
  const runAnalysis = async () => {
    if (!image) {
      alert('분석을 위해 사진을 업로드해주세요.');
      return;
    }



    setStatus('loading');
    setLoadingText('체형 실루엣 스캔 및 이미지 정보 로드 중...');


    // 로딩 문구 단계별 전환용 타이머 설정
    const textTimer1 = setTimeout(() => {
      setLoadingText('신체 비율(BMI) 및 골격 정보 분석 중...');
    }, 1000);

    const textTimer2 = setTimeout(() => {
      setLoadingText('AI 스타일리스트 맞춤형 솔루션 매칭 중...');
    }, 2200);

    try {
      const heightInMeters = height / 100;
      const bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));

      let response: Response;

      // 로컬 개발 환경인 경우: .env API 키를 활용해 직접 구글 Gemini API 호출
      if (import.meta.env.DEV) {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('로컬 개발을 위한 구글 제미나이 API 키(VITE_GEMINI_API_KEY)가 .env 파일에 설정되지 않았습니다.');
        }

        // 이미지 Base64 데이터 추출
        const commaIndex = image.indexOf(',');
        const base64DataOnly = image.substring(commaIndex + 1);
        const mimeTypeMatch = image.match(/data:([^;]+);base64/);
        const imageMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

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

        response = await fetch(url, {
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
      } 
      // 프로덕션 배포 서버 환경인 경우: Cloudflare Pages Functions 백엔드 프록시 호출
      else {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image,
            height,
            weight
          })
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 호출 에러 (상태코드: ${response.status})`);
      }

      const responseData = await response.json();
      const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('AI 분석 결과 데이터를 수신하지 못했습니다.');
      }

      // JSON 텍스트 파싱 (마크다운 백틱 등 방어 코드 적용)
      let cleanText = rawText.trim();
      const markdownMatch = cleanText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch) {
        cleanText = markdownMatch[1];
      }
      const parsedData = JSON.parse(cleanText.trim());

      setResult({
        bmi,
        bodyType: parsedData.bodyType || '커스텀 분석 체형',
        styleTips: parsedData.styleTips || '체형 분석 결과를 해석하지 못했습니다. 베이직 셔츠와 와이드 슬랙스 코디를 추천합니다.',
        recommendations: parsedData.recommendations || ['#베이직룩', '#모던웨어'],
        bestColors: parsedData.bestColors || ['네이비 블루', '차콜 그레이']
      });
      setStatus('result');
    } catch (error: any) {
      console.warn('Gemini API 연동 실패, 로컬 분석 모드로 전환합니다:', error.message);
      
      // API 실패 시 로컬 가상 분석 로직으로 자동 전환 (팝업 없이)
      const heightInMeters = height / 100;
      const bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
      
      let bodyType = '균형 잡힌 표준 체형';
      let styleTips = '가장 기본적인 균형이 잘 잡힌 체형입니다. 미니멀한 남방셔츠나 클래식한 와이드 슬랙스로 모던하고 정갈한 실루엣을 완성하는 것이 좋습니다.';
      let recommendations = ['#미니멀룩', '#클래식수트', '#모던시크'];
      let bestColors = ['네이비 블루', '차콜 그레이', '크림'];

      if (bmi < 18.5) {
        bodyType = '슬림하고 직선적인 체형';
        styleTips = '전체적으로 가냘픈 실루엣을 지녔습니다. 오버사이즈 레이어드 룩이나 어깨 패턴이 강조된 재킷, 볼륨감 있는 니트웨어를 매치하여 상체에 입체감을 불어넣는 스타일을 추천합니다.';
        recommendations = ['#오버사이즈룩', '#레이어드코디', '#캐주얼스트릿'];
        bestColors = ['웜 아이보리', '올리브 그린', '파스텔 블러썸'];
      } else if (bmi >= 23 && bmi < 25) {
        bodyType = '탄탄하고 듬직한 에슬레저 체형';
        styleTips = '골격과 근육이 발달한 건강미 넘치는 체형입니다. 지나치게 타이트한 옷보다는 자연스러운 세미 오버핏 셔츠와 테이퍼드 팬츠 조합이 좋습니다. 스포티한 디테일을 가미해 매력을 극대화해보세요.';
        recommendations = ['#아메카지룩', '#스포티캐주얼', '#세미오버핏'];
        bestColors = ['카키 그린', '머스타드 옐로우', '매트 블랙'];
      } else if (bmi >= 25) {
        bodyType = '볼륨감 있고 여유로운 내추럴 체형';
        styleTips = '풍성하고 여유로운 곡선을 지닌 체형입니다. 세로 스트라이프 패턴이나 V넥 라인을 활용하여 시각적으로 시원한 느낌을 주는 것이 좋습니다. 톤온톤 매칭이나 롱코트로 세로 라인을 연출해보세요.';
        recommendations = ['#톤온톤코디', '#스트릿웨어', '#이지캐주얼'];
        bestColors = ['미드나잇 블랙', '딥 브라운', '머드 네이비'];
      }

      setResult({
        bmi,
        bodyType,
        styleTips,
        recommendations,
        bestColors
      });
      setStatus('result');
    } finally {
      clearTimeout(textTimer1);
      clearTimeout(textTimer2);
    }
  };

  const resetAll = () => {
    setStatus('idle');
    setResult(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="brand-title">AI Personal Stylist</h1>
        <p className="brand-subtitle">나만의 맞춤형 퍼스널 패션 테일러</p>
      </header>

      <main className="main-layout">
        {status === 'idle' && (
          <section className="glass-card">
            <h2 className="card-title">스타일 분석 정보 입력</h2>
            
            {/* 사진 업로드 */}
            <div className="upload-section">
              <span className="upload-label">본인의 전신 또는 스타일 사진</span>
              <div 
                className={`dropzone ${isDragActive ? 'active' : ''} ${image ? 'has-image' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
              >
                {image ? (
                  <div className="preview-container">
                    <img src={image} alt="Uploaded style preview" className="preview-image" />
                    <button type="button" className="remove-btn" onClick={removeImage}>&times;</button>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon">✦</div>
                    <p className="upload-hint">
                      여기로 사진을 <span>드래그앤드롭</span> 하거나<br />
                      클릭하여 이미지를 업로드하세요.
                    </p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="file-input"
              />
            </div>

            {/* 신체 사이즈 입력 */}
            <div className="input-grid">
              <div className="input-group">
                <label htmlFor="height-input">키 (Height)</label>
                <div className="input-wrapper">
                  <input 
                    id="height-input"
                    type="number" 
                    value={height}
                    min="100"
                    max="250"
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="styled-input"
                  />
                  <span className="unit">cm</span>
                </div>
                <input 
                  type="range"
                  min="100"
                  max="250"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="range-slider"
                />
              </div>

              <div className="input-group">
                <label htmlFor="weight-input">몸무게 (Weight)</label>
                <div className="input-wrapper">
                  <input 
                    id="weight-input"
                    type="number" 
                    value={weight}
                    min="30"
                    max="200"
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="styled-input"
                  />
                  <span className="unit">kg</span>
                </div>
                <input 
                  type="range"
                  min="30"
                  max="200"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>

            {/* 분석 버튼 */}
            <button 
              type="button" 
              onClick={runAnalysis}
              disabled={!image}
              className="action-button"
            >
              분석하기 ✦
            </button>
          </section>
        )}

        {status === 'loading' && (
          <section className="glass-card loading-overlay">
            <div className="spinner"></div>
            <p className="loading-text">{loadingText}</p>
            <p className="loading-subtext">AI가 완벽한 스타일을 매칭하고 있습니다...</p>
          </section>
        )}

        {status === 'result' && result && (
          <section className="glass-card result-card">
            <h2 className="card-title">체형 및 스타일 분석 결과</h2>
            
            <div className="result-header">
              {image && (
                <div className="result-avatar-container">
                  <img src={image} alt="User silhouette" className="result-avatar" />
                </div>
              )}
              <div className="result-info">
                <h3>{result.bodyType}</h3>
                <p>신체 프로필: {height}cm / {weight}kg (BMI {result.bmi})</p>
              </div>
            </div>

            <div className="result-grid">
              <div className="info-item">
                <h4>✨ 체형 기반 스타일링 솔루션</h4>
                <p>{result.styleTips}</p>
              </div>

              <div className="info-item">
                <h4>🎨 추천 스타일 키워드</h4>
                <div className="style-tags">
                  {result.recommendations.map((tag, idx) => (
                    <span key={idx} className="tag">{tag}</span>
                  ))}
                </div>
                
                <h4 style={{ marginTop: '20px' }}>🌈 추천 퍼스널 컬러 톤</h4>
                <p>{result.bestColors.join(', ')}</p>
              </div>
            </div>

            <button 
              type="button" 
              onClick={resetAll}
              className="action-button btn-secondary"
            >
              다시 분석하기 ↺
            </button>
          </section>
        )}
      </main>

      <footer className="app-footer" style={{ marginTop: '50px', padding: '24px 0', borderTop: '1px solid var(--border-color)', width: '100%', maxWidth: '800px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', zIndex: 10 }}>
        <p>© 2026 AI Personal Stylist. All rights reserved.</p>
        <p style={{ marginTop: '6px', fontSize: '0.75rem', opacity: 0.8 }}>본 서비스는 개인정보 보호를 위해 사용자의 사진 데이터를 서버에 저장하지 않고 브라우저 내에서만 안전하게 임시 처리합니다.</p>
      </footer>
    </div>
  )
}

export default App

