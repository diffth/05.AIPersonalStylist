import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'

type AppState = 'idle' | 'loading' | 'result';

interface AnalysisResult {
  bmi: number;
  bodyType: string;
  bodyAnalysis: string;
  bestColors: string[];
  personalColorTips: string;
  recommendations: string[];
  recommendedItems: string;
  avoidStyles: string;
  styleTips: string;
}

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(62);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [status, setStatus] = useState<AppState>('idle');
  const [loadingText, setLoadingText] = useState<string>('이미지를 분석하고 있습니다...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // scrolled 상태 선언
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [scrollY, setScrollY] = useState<number>(0);

  // Supabase Auth 관련 상태
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.pageYOffset);
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Supabase Auth 세션 리스너 및 초기 조회
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn("Supabase is not configured. Authentication features are disabled.");
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 스크롤 리빌 애니메이션 효과
  useEffect(() => {
    const revealCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    };

    const observer = new IntersectionObserver(revealCallback, {
      threshold: 0.1
    });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [status]);

  // 인증 제출 처리
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setIsAuthModalOpen(false);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert('회원가입 요청이 전달되었습니다. 가입 승인 이메일을 확인하거나 로그인해 주세요!');
        setAuthMode('login');
        setAuthPassword('');
      }
    } catch (err: any) {
      if (err.message === 'email rate limit exceeded' || err.message?.includes('rate limit')) {
        setAuthError('단시간 내에 너무 많은 인증 메일이 발송되었습니다. (수파베이스 1시간 발송 제한 초과)\n\n[해결 방법]\nSupabase 대시보드 -> Authentication -> Providers -> Email 메뉴에서 "Confirm email" 설정을 꺼주시면 인증 메일 발송 없이 즉시 가입 및 로그인이 가능합니다!');
      } else {
        setAuthError(err.message || '인증 에러가 발생했습니다.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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

  // 분석 실행
  const runAnalysis = async () => {
    // Supabase가 구성되었을 때만 로그인을 요구합니다. 구성되지 않았을 때는 데모 모드로 바로 분석 가능하게 조치합니다.
    if (isSupabaseConfigured && !user) {
      setAuthError('스타일 분석을 이용하려면 먼저 로그인해야 합니다.');
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    if (!image) {
      alert('분석을 위해 사진을 업로드해주세요.');
      return;
    }

    setStatus('loading');
    setLoadingText('체형 실루엣 스캔 및 이미지 정보 로드 중...');

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

      if (import.meta.env.DEV) {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('로컬 개발을 위한 구글 제미나이 API 키(VITE_GEMINI_API_KEY)가 .env 파일에 설정되지 않았습니다.');
        }

        const commaIndex = image.indexOf(',');
        const base64DataOnly = image.substring(commaIndex + 1);
        const mimeTypeMatch = image.match(/data:([^;]+);base64/);
        const imageMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

        const prompt = `당신은 전문 퍼스널 스타일리스트입니다.
사용자의 사진과 신체정보(키: ${height}cm, 몸무게: ${weight}kg, 계산된 BMI: ${bmi})를 분석하여 맞춤형 스타일 컨설팅 보고서를 작성해주세요.

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
      } else {
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

      let cleanText = rawText.trim();
      const markdownMatch = cleanText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch) {
        cleanText = markdownMatch[1];
      }
      const parsedData = JSON.parse(cleanText.trim());

      setResult({
        bmi,
        bodyType: parsedData.bodyType || '커스텀 분석 체형',
        bodyAnalysis: parsedData.bodyAnalysis || '골격과 실루엣 비율이 균형을 이루는 체형입니다.',
        bestColors: parsedData.bestColors || ['네이비 블루', '차콜 그레이', '크림'],
        personalColorTips: parsedData.personalColorTips || '차분한 모노톤 계열로 도회적인 느낌을 줍니다.',
        recommendations: parsedData.recommendations || ['#베이직룩', '#모던웨어', '#데일리코디'],
        recommendedItems: parsedData.recommendedItems || '기본 티셔츠와 와이드 핏 슬랙스',
        avoidStyles: parsedData.avoidStyles || '체형에 과도하게 맞지 않는 과장된 디테일의 아우터',
        styleTips: parsedData.styleTips || '체형 분석 결과를 해석하지 못했습니다. 베이직 셔츠와 와이드 슬랙스 코디를 추천합니다.'
      });
      setStatus('result');
    } catch (error: any) {
      console.warn('Gemini API 연동 실패, 로컬 분석 모드로 전환합니다:', error.message);
      
      const heightInMeters = height / 100;
      const bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
      
      let bodyType = '균형 잡힌 표준 체형';
      let bodyAnalysis = '상하체의 비율이 조화롭고 대칭이 잘 맞는 가장 이상적인 표준형 골격을 지니고 있습니다. 유행하는 다양한 스타일을 무난하고 세련되게 소화할 수 있는 강력한 장점이 있습니다.';
      let bestColors = ['네이비 블루', '차콜 그레이', '크림'];
      let personalColorTips = '단정하고 지적인 매력을 돋보이게 하는 네이비와 차콜 그레이를 베이스로 삼고, 부드러운 크림색으로 포인트를 주면 신뢰감을 주는 스타일이 완성됩니다.';
      let recommendations = ['#미니멀룩', '#클래식수트', '#모던시크'];
      let recommendedItems = '클래식한 와이드 슬랙스, 딱 떨어지는 핏의 베이직 셔츠, 미니멀한 가죽 재킷, 단정한 로퍼';
      let avoidStyles = '상하체의 예쁜 비율을 가려버리는 지나치게 크고 형태감이 없는 벌룬 핏이나 어중간한 기장의 아우터';
      let styleTips = '허리 라인을 살려 단정하게 셔츠를 바지 안으로 넣어 입거나(넣입), 깔끔한 톤온톤 셋업 스타일링으로 본연의 훌륭한 비율을 극대화해 보세요.';

      if (bmi < 18.5) {
        bodyType = '슬림하고 직선적인 체형';
        bodyAnalysis = '전체적으로 체지방률이 낮고 골격이 가늘어 실루엣이 직선적이고 가냘픈 느낌을 줍니다. 바디라인의 굴곡보다는 모던하고 슬림한 느낌을 강조하거나 볼륨감을 레이어드로 보완하기에 적합합니다.';
        bestColors = ['웜 아이보리', '올리브 그린', '파스텔 블러썸'];
        personalColorTips = '따뜻하고 부드러운 파스텔 톤과 아이보리는 왜소해 보일 수 있는 실루엣을 시각적으로 팽창시켜 주어 한결 안정감 있고 부드러운 인상을 만듭니다.';
        recommendations = ['#오버사이즈룩', '#레이어드코디', '#캐주얼스트릿'];
        recommendedItems = '벌키한 니트웨어, 어깨 패드가 들어간 테일러드 재킷, 카고 팬츠, 레이어드용 롱 셔츠';
        avoidStyles = '온몸에 꽉 끼는 타이트한 스키니진이나 민소매 상의는 가냘픈 체형을 더욱 도드라지게 하므로 피하는 것이 좋습니다.';
        styleTips = '오버사이즈 재킷에 루즈핏 팬츠를 매치하거나, 셔츠 위에 니트 베스트를 겹쳐 입는 레이어드 룩으로 입체적인 실루엣을 완성해보세요.';
      } else if (bmi >= 23 && bmi < 25) {
        bodyType = '탄탄하고 듬직한 에슬레저 체형';
        bodyAnalysis = '어깨와 바스트, 골격이 발달하고 근육질의 건강미가 돋보이는 체형입니다. 강인하고 활동적인 이미지를 풍기며, 스포티하고 편안한 어반 아웃도어나 아메카지 룩이 매우 잘 어울립니다.';
        bestColors = ['카키 그린', '머스타드 옐로우', '매트 블랙'];
        personalColorTips = '자연스럽고 묵직한 카키와 블랙은 체격을 탄탄하게 잡아주며, 머스타드 컬러로 액티브하고 캐주얼한 포인트를 주기 좋습니다.';
        recommendations = ['#아메카지룩', '#스포티캐주얼', '#세미오버핏'];
        recommendedItems = '자연스러운 세미 오버핏 셔츠, 테이퍼드 핏 데님 팬츠, 워크 재킷, 스니커즈';
        avoidStyles = '과도하게 꽉 끼는 머슬핏 상의나 스키니진은 골격을 너무 부각시켜 다소 답답하거나 비대해 보일 수 있으니 지양해 주세요.';
        styleTips = '어깨선이 살짝 내려오는 세미 오버 실루엣의 상의와 아래로 갈수록 좁아지는 테이퍼드 팬츠를 매치하면 편안하면서도 균형 잡힌 실루엣이 연출됩니다.';
      } else if (bmi >= 25) {
        bodyType = '볼륨감 있고 여유로운 내추럴 체형';
        bodyAnalysis = '전체적으로 곡선이 살아있고 체격에 여유와 볼륨감이 느껴지는 편안하고 내추럴한 체형입니다. 시각적으로 시원한 세로 라인을 살려 연출하면 고급스럽고 품격 있는 무드를 자아낼 수 있습니다.';
        bestColors = ['미드나잇 블랙', '딥 브라운', '머드 네이비'];
        personalColorTips = '무게감이 있는 어두운 톤의 딥 브라운과 미드나잇 블랙은 바디 라인을 한층 차분하고 슬림하게 정돈해 주는 수축 효과가 뛰어납니다.';
        recommendations = ['#톤온톤코디', '#스트릿웨어', '#이지캐주얼'];
        recommendedItems = '세로 스트라이프 패턴 셔츠, 루즈핏 브이넥 니트, 무릎 아래로 내려오는 롱 싱글코트, 일자핏 스트레이트 팬츠';
        avoidStyles = '목을 답답하게 덮는 터틀넥이나 너무 얇고 번들거리는 실크 소재, 가로 스트라이프 패턴은 체형을 팽창시켜 보일 수 있으니 주의해 주세요.';
        styleTips = '상의와 하의의 톤을 비슷하게 맞추는 톤온톤 코디를 선택하고, 아우터를 오픈하여 자연스러운 세로 실루엣을 만드는 것이 날씬해 보이는 꿀팁입니다.';
      }

      setResult({
        bmi,
        bodyType,
        bodyAnalysis,
        bestColors,
        personalColorTips,
        recommendations,
        recommendedItems,
        avoidStyles,
        styleTips
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
    <div className="bg-surface text-on-surface font-body-md selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-surface/80 backdrop-blur-md shadow-sm border-b border-outline-variant/20' : 'bg-transparent'}`}>
        <nav className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto w-full">
          <div className="font-display-lg text-headline-sm tracking-tighter text-charcoal-text cursor-pointer" onClick={resetAll}>AURA FASHION</div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-primary border-b-2 border-primary pb-1 font-body-sm" href="#" onClick={(e) => { e.preventDefault(); resetAll(); }}>Styling</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-sm" href="#" onClick={(e) => e.preventDefault()}>Virtual Closet</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-sm" href="#" onClick={(e) => e.preventDefault()}>Trending</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-sm" href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-on-surface-variant text-body-sm font-semibold hidden md:inline">{user.email}</span>
                <button 
                  onClick={handleSignOut} 
                  className="text-primary font-button hover:opacity-80 transition-opacity"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(''); setIsAuthModalOpen(true); }}
                  className="text-primary font-button hover:opacity-80 transition-opacity"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setAuthMode('signup'); setAuthError(''); setIsAuthModalOpen(true); }}
                  className="bg-primary text-on-primary px-6 py-2 rounded-full font-button hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                  Join Club
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="pt-24 flex-grow">
        {/* Supabase 설정 누락 경고 배너 */}
        {!isSupabaseConfigured && (
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-4 mb-4">
            <div className="bg-error-container/60 backdrop-blur-md border border-error/20 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-error text-3xl mt-0.5 md:mt-0">warning</span>
                <div className="text-left">
                  <h3 className="font-semibold text-charcoal-text text-lg">Supabase 환경 변수가 설정되지 않았습니다</h3>
                  <p className="text-on-surface-variant text-body-sm mt-1 max-w-2xl leading-relaxed">
                    현재 회원가입 및 로그인 등 Supabase 연동 기능이 비활성화된 상태입니다. <br className="hidden sm:inline" />
                    <strong>Cloudflare Pages</strong>에 배포하셨다면 Pages 대시보드의 <strong>Settings &gt; Variables</strong> 설정에 <code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_ANON_KEY</code>를 등록하고 다시 배포해 주세요! (로컬인 경우 <code>.env</code> 파일 설정을 확인하세요)
                  </p>
                </div>
              </div>
              <a 
                href="https://dash.cloudflare.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-error text-white font-button px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all text-center self-stretch md:self-auto text-sm shrink-0 shadow-md"
              >
                대시보드로 가기
              </a>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <>
            {/* Hero Section */}
            <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 gap-12 items-center min-h-[80vh] py-12 md:py-24">
              <div className="order-2 md:order-1 reveal active">
                <span className="font-label-caps text-primary tracking-widest block mb-4">REDEFINING PERSONAL STYLE</span>
                <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg mb-6 leading-tight">
                  Your AI Style <br /><span className="italic font-normal">Evolution</span>
                </h1>
                <p className="text-body-lg text-on-surface-variant mb-10 max-w-md">
                  Experience a luxury styling journey powered by advanced neural analysis. Aura understands your silhouette, your vibe, and your future wardrobe.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a className="bg-deep-lavender text-on-primary px-8 py-4 rounded-lg font-button shadow-lg hover:shadow-xl transition-all active:scale-95 text-center" href="#analysis-start">
                    Start Your Evolution
                  </a>
                  <button className="border border-outline-variant text-on-surface px-8 py-4 rounded-lg font-button hover:bg-surface-container transition-colors">
                    Explore Looks
                  </button>
                </div>
              </div>
              <div className="order-1 md:order-2 relative reveal active" style={{ transitionDelay: '200ms' }}>
                <div className="rounded-2xl overflow-hidden shadow-2xl aspect-[4/5] transform md:rotate-2 hover:rotate-0 transition-transform duration-700">
                  <img 
                    alt="Fashion editorial image" 
                    className="w-full h-full object-cover transition-transform duration-300" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAn2eUA4R5swD506hmnsLD0-jKQnZPv7ba1GVuv5l2Q8CLfRKEieiMdnsm7oFhyIMh7XWPzC3XeEM6mXjWsJrKWdsM7zoWPma61kReZSjmacGqLWf9lCP1KiTftjsdCbqHhPWs7dLnCpuFbVw52fMdMH2OKoOOFYqH5o9WSc4bkVgjkCXAKsR-W7fmjZbdD1zHYVHDYrJy3bI86oVR94UdWSKsDWC6KYZslQgb2sUk4cl0fAQSzs80C"
                    style={{ transform: `translateY(${scrollY * 0.05}px)` }}
                  />
                </div>
                <div className="absolute -bottom-6 -left-6 glass-card p-6 rounded-xl hidden md:block shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    </div>
                    <div>
                      <p className="font-label-caps text-on-surface text-xs font-semibold">AI ANALYSIS READY</p>
                      <p className="text-body-sm text-on-surface-variant text-xs">98.4% Precision Score</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Style Analysis Form Section */}
            <section className="bg-surface-container-low py-16 md:py-24" id="analysis-start">
              <div className="max-w-3xl mx-auto px-margin-mobile reveal active">
                <div className="text-center mb-12">
                  <h2 className="font-headline-md text-on-surface mb-4">Precision Profiling</h2>
                  <p className="text-body-md text-on-surface-variant">Input your measurements for a hyper-accurate 3D silhouette reconstruction.</p>
                </div>
                <div className="glass-card p-8 md:p-12 rounded-3xl shadow-sm border border-outline-variant/30">
                  <form className="space-y-12" onSubmit={(e) => e.preventDefault()}>
                    {/* Measurements Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Height Slider */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <label className="font-label-caps text-on-surface-variant tracking-wider font-semibold">HEIGHT (CM)</label>
                          <span className="font-headline-sm text-primary font-bold" id="height-val">{height}</span>
                        </div>
                        <input 
                          className="w-full h-1.5 bg-outline-variant rounded-lg appearance-none cursor-pointer" 
                          id="height-slider" 
                          max="210" 
                          min="140" 
                          type="range" 
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                        />
                        <div className="flex justify-between text-[10px] text-outline font-bold">
                          <span>140CM</span>
                          <span>210CM</span>
                        </div>
                      </div>
                      
                      {/* Weight Slider */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <label className="font-label-caps text-on-surface-variant tracking-wider font-semibold">WEIGHT (KG)</label>
                          <span className="font-headline-sm text-primary font-bold" id="weight-val">{weight}</span>
                        </div>
                        <input 
                          className="w-full h-1.5 bg-outline-variant rounded-lg appearance-none cursor-pointer" 
                          id="weight-slider" 
                          max="150" 
                          min="40" 
                          type="range" 
                          value={weight}
                          onChange={(e) => setWeight(Number(e.target.value))}
                        />
                        <div className="flex justify-between text-[10px] text-outline font-bold">
                          <span>40KG</span>
                          <span>150KG</span>
                        </div>
                      </div>
                    </div>

                    {/* Photo Upload Zone */}
                    <div className="space-y-6">
                      <label className="font-label-caps text-on-surface-variant block text-center tracking-wider font-semibold">SILHOUETTE CAPTURE</label>
                      <div 
                        className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center group transition-all cursor-pointer ${
                          isDragActive 
                            ? 'border-primary bg-primary/5 shadow-inner' 
                            : 'border-outline-variant bg-surface/50 hover:border-primary hover:bg-primary/5'
                        }`} 
                        id="upload-zone"
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={triggerFileInput}
                      >
                        {image ? (
                          <div className="relative w-full max-w-[240px] aspect-[3/4] rounded-lg overflow-hidden shadow-md" onClick={(e) => e.stopPropagation()}>
                            <img src={image} alt="Uploaded style preview" className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-xl hover:bg-black/80 transition-colors shadow-lg" 
                              onClick={removeImage}
                            >
                              &times;
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                              <span className="material-symbols-outlined text-primary text-3xl">add_a_photo</span>
                            </div>
                            <h3 className="text-body-lg font-semibold text-on-surface mb-2">Upload Full-Body Photo</h3>
                            <p className="text-body-sm text-on-surface-variant text-center max-w-sm mb-6">
                              Drag and drop or click to browse. Supported formats: JPG, PNG (Max 10MB).
                            </p>
                            <div className="flex gap-8 items-center pt-6 border-t border-outline-variant/30 w-full justify-center">
                              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                                <span className="material-symbols-outlined text-primary text-lg">light_mode</span>
                                Well-lit
                              </div>
                              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                                <span className="material-symbols-outlined text-primary text-lg">person</span>
                                Full-body
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-3 bg-secondary-container/30 py-3 px-6 rounded-lg border border-secondary-container/50">
                        <span className="material-symbols-outlined text-secondary text-lg" data-weight="fill">lock</span>
                        <p className="text-body-sm text-on-secondary-fixed-variant text-xs">
                          Your photos are processed securely and deleted immediately after analysis.
                        </p>
                      </div>
                    </div>

                    {/* Submit Action */}
                    <div className="pt-6">
                      <button 
                        type="button" 
                        onClick={runAnalysis}
                        disabled={!image}
                        className={`w-full text-on-primary font-button text-lg py-5 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all ${
                          image ? 'bg-primary cursor-pointer hover:opacity-95' : 'bg-primary/40 cursor-not-allowed opacity-60'
                        }`}
                      >
                        Start Style Analysis
                      </button>
                      <p className="text-center text-[10px] text-outline mt-4 font-label-caps tracking-wider">BY PROCEEDING, YOU AGREE TO OUR BIOMETRIC DATA POLICY</p>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Trust & Value Proposition */}
            <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-24">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-4 text-center md:text-left reveal active">
                  <span className="material-symbols-outlined text-4xl text-primary" data-weight="fill">verified</span>
                  <h4 className="font-headline-sm font-semibold">Privacy First</h4>
                  <p className="text-body-md text-on-surface-variant">Our SOC-2 compliant engine ensures your biometric data never leaves our encrypted sandbox.</p>
                </div>
                <div className="space-y-4 text-center md:text-left reveal active" style={{ transitionDelay: '100ms' }}>
                  <span className="material-symbols-outlined text-4xl text-primary" data-weight="fill">psychology</span>
                  <h4 className="font-headline-sm font-semibold">AI-First Design</h4>
                  <p className="text-body-md text-on-surface-variant">Trained on 50 years of haute couture and street style history to find your unique aesthetic.</p>
                </div>
                <div className="space-y-4 text-center md:text-left reveal active" style={{ transitionDelay: '200ms' }}>
                  <span className="material-symbols-outlined text-4xl text-primary" data-weight="fill">shopping_bag</span>
                  <h4 className="font-headline-sm font-semibold">Smart Shopping</h4>
                  <p className="text-body-md text-on-surface-variant">Direct links to retailers with pre-vetted sizes that actually fit your body shape perfectly.</p>
                </div>
              </div>
            </section>
          </>
        )}

        {status === 'loading' && (
          <div className="min-h-[70vh] flex items-center justify-center px-margin-mobile">
            <div className="glass-card p-12 rounded-3xl shadow-xl border border-outline-variant/30 max-w-md w-full text-center space-y-6 reveal active">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary-container/30"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                <span className="material-symbols-outlined text-primary text-3xl absolute inset-0 flex items-center justify-center animate-pulse">auto_awesome</span>
              </div>
              <h3 className="text-headline-sm text-on-surface font-semibold">{loadingText}</h3>
              <p className="text-body-sm text-on-surface-variant">AI가 체형의 특징을 실시간 스캔하여 맞춤형 패션 처방을 조율하는 중입니다.</p>
            </div>
          </div>
        )}

        {status === 'result' && result && (
          <div className="max-w-4xl mx-auto px-margin-mobile py-12 reveal active">
            <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/30">
              <div className="bg-primary/10 p-8 md:p-12 border-b border-outline-variant/20 flex flex-col md:flex-row items-center gap-8">
                {image && (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg shrink-0">
                    <img src={image} alt="User silhouette" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-center md:text-left space-y-2">
                  <span className="font-label-caps text-primary tracking-widest block font-bold text-xs">ANALYSIS REPORT</span>
                  <h2 className="font-headline-md text-on-surface font-semibold text-2xl md:text-3xl">{result.bodyType}</h2>
                  <p className="text-body-md text-on-surface-variant">
                    신체 프로필: <span className="font-semibold text-primary">{height}cm</span> / <span className="font-semibold text-primary">{weight}kg</span> (BMI {result.bmi})
                  </p>
                </div>
              </div>
              
              <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  {/* 1. 체형 분석 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined">accessibility_new</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">1. 체형 분석 보고</h4>
                    </div>
                    <p className="text-body-md text-on-surface-variant leading-relaxed bg-surface/40 p-5 rounded-2xl border border-outline-variant/20">
                      {result.bodyAnalysis}
                    </p>
                  </div>

                  {/* 3. 어울리는 스타일 및 패션 아이템 추천 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined">checkroom</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">3. 추천 패션 아이템</h4>
                    </div>
                    <p className="text-body-md text-on-surface-variant leading-relaxed bg-surface/40 p-5 rounded-2xl border border-outline-variant/20">
                      {result.recommendedItems}
                    </p>
                  </div>

                  {/* 4. 피해야 할 스타일 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-error">
                      <span className="material-symbols-outlined">block</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">4. 피해야 할 워스트 스타일</h4>
                    </div>
                    <p className="text-body-md text-on-surface-variant leading-relaxed bg-error-container/10 p-5 rounded-2xl border border-error/20">
                      {result.avoidStyles}
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* 2. 퍼스널 컬러 추천 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined">palette</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">2. 퍼스널 컬러 제안</h4>
                    </div>
                    <div className="bg-surface/40 p-5 rounded-2xl border border-outline-variant/20 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {result.bestColors.map((color, idx) => (
                          <span key={idx} className="bg-primary/5 border border-primary/20 px-3.5 py-1.5 rounded-full text-body-sm font-semibold text-primary">
                            {color}
                          </span>
                        ))}
                      </div>
                      <p className="text-body-md text-on-surface-variant leading-relaxed text-sm">
                        {result.personalColorTips}
                      </p>
                    </div>
                  </div>

                  {/* 5. 코디 팁 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined">auto_awesome</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">5. 실전 스타일링 코디 팁</h4>
                    </div>
                    <p className="text-body-md text-on-surface-variant leading-relaxed bg-primary-container/10 p-5 rounded-2xl border border-primary/20">
                      {result.styleTips}
                    </p>
                  </div>

                  {/* 추천 스타일 키워드 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined">style</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">스타일링 키워드</h4>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {result.recommendations.map((tag, idx) => (
                        <span key={idx} className="bg-secondary-container/40 text-on-secondary-container px-3.5 py-1.5 rounded-full text-body-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 전문 퍼스널 스타일리스트 안내 푸터 배너 */}
              <div className="bg-secondary-container/10 border-t border-outline-variant/10 p-6 text-center text-body-sm text-on-surface-variant/80 italic flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">verified_user</span>
                <span>본 보고서는 전문 퍼스널 스타일리스트가 사용자의 사진과 신체 정보를 종합적으로 정밀 분석하여 작성한 맞춤형 프리미엄 컨설팅 결과입니다.</span>
              </div>

              <div className="p-8 bg-surface-container/50 border-t border-outline-variant/10 flex justify-center">
                <button 
                  type="button" 
                  onClick={resetAll}
                  className="bg-primary text-on-primary px-8 py-4 rounded-xl font-button shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2 hover:opacity-95"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  다시 분석하기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-margin-mobile" onClick={() => setIsAuthModalOpen(false)}>
          <div className="glass-card p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-outline-variant/30 relative space-y-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => setIsAuthModalOpen(false)}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            
            <div className="text-center">
              <h3 className="text-headline-sm text-on-surface font-bold text-xl">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1 text-xs">
                {authMode === 'login' ? 'AURA의 프리미엄 AI 스타일 분석을 경험하세요' : 'AURA 클럽의 멤버가 되어 스타일 진화를 시작하세요'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleAuth}>
              <div>
                <label className="font-label-caps text-on-surface-variant block mb-1 text-[10px] font-bold tracking-wider">EMAIL</label>
                <input 
                  type="email" 
                  required 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface/50 text-on-surface focus:outline-none focus:border-primary transition-colors text-body-sm"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="font-label-caps text-on-surface-variant block mb-1 text-[10px] font-bold tracking-wider">PASSWORD</label>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface/50 text-on-surface focus:outline-none focus:border-primary transition-colors text-body-sm"
                  placeholder="•••••• (6자 이상)"
                />
              </div>

              {authError && (
                <p className="text-error text-xs text-left bg-error-container/20 p-3 rounded-lg border border-error/20 leading-relaxed whitespace-pre-line font-medium">
                  {authError}
                </p>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-button shadow-lg hover:shadow-xl hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">login</span>
                    {authMode === 'login' ? '로그인' : '회원 가입'}
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-outline-variant/20">
              <button 
                type="button" 
                className="text-primary font-button text-xs hover:underline cursor-pointer"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
              >
                {authMode === 'login' ? '계정이 없으신가요? 회원 가입하기' : '이미 계정이 있으신가요? 로그인하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-surface-container border-t border-outline-variant mt-12">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col md:flex-row justify-between items-center gap-8 w-full">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="font-display-lg text-headline-sm text-primary font-bold">AURA</div>
            <p className="text-body-sm text-on-surface-variant text-center md:text-left text-xs">© 2026 AURA AI Fashion Consultant. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline text-xs" href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline text-xs" href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline text-xs" href="#" onClick={(e) => e.preventDefault()}>GDPR Compliance</a>
            <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline text-xs" href="#" onClick={(e) => e.preventDefault()}>Support</a>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-high cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-sm">social_leaderboard</span>
            </div>
            <div className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-high cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-sm">share</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
