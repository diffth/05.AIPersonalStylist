import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'

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
        styleTips: parsedData.styleTips || '체형 분석 결과를 해석하지 못했습니다. 베이직 셔츠와 와이드 슬랙스 코디를 추천합니다.',
        recommendations: parsedData.recommendations || ['#베이직룩', '#모던웨어'],
        bestColors: parsedData.bestColors || ['네이비 블루', '차콜 그레이']
      });
      setStatus('result');
    } catch (error: any) {
      console.warn('Gemini API 연동 실패, 로컬 분석 모드로 전환합니다:', error.message);
      
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
        styleTips = '골격과 근육이 발달한 건강미 넘치는 체형입니다. 지나치게 타이트한 옷보다는 자연스러운 세미 오버핏 셔츠 and 테이퍼드 팬츠 조합이 좋습니다. 스포티한 디테일을 가미해 매력을 극대화해보세요.';
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
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    <h4 className="font-label-caps font-bold tracking-wider text-xs">체형 기반 스타일링 솔루션</h4>
                  </div>
                  <p className="text-body-md text-on-surface-variant leading-relaxed bg-surface/50 p-6 rounded-2xl border border-outline-variant/20">
                    {result.styleTips}
                  </p>
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-2 text-primary mb-4">
                      <span className="material-symbols-outlined">style</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">추천 스타일 키워드</h4>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {result.recommendations.map((tag, idx) => (
                        <span key={idx} className="bg-primary/10 text-primary px-4 py-2 rounded-full text-body-sm font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-primary mb-3">
                      <span className="material-symbols-outlined">palette</span>
                      <h4 className="font-label-caps font-bold tracking-wider text-xs">추천 퍼스널 컬러 톤</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.bestColors.map((color, idx) => (
                        <span key={idx} className="border border-outline-variant/40 bg-surface/30 px-4 py-2 rounded-lg text-body-sm text-on-surface-variant">
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
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
