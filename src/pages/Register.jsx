import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude I, O, 1, 0, Q to avoid confusion

const createCaptchaCode = () => {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CAPTCHA_CHARS.charAt(
      Math.floor(Math.random() * CAPTCHA_CHARS.length),
    );
  }
  return code;
};

const Register = () => {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [captchaCode, setCaptchaCode] = useState(() => createCaptchaCode());
  const canvasRef = useRef(null);

  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const drawCaptcha = useCallback((code) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Random background color
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Code
    ctx.font = "bold 24px Arial";
    ctx.textBaseline = "middle";
    for (let i = 0; i < code.length; i++) {
      ctx.save();
      ctx.translate(20 + i * 20, canvas.height / 2);
      ctx.rotate((Math.random() - 0.5) * 0.4);
      ctx.fillStyle = `hsl(${Math.random() * 360}, 50%, 30%)`;
      ctx.fillText(code[i], -10, 0);
      ctx.restore();
    }

    // Add Noise (Lines)
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Add Noise (Dots)
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        1,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }
  }, []);

  const regenerateCaptcha = useCallback(() => {
    setCaptchaCode(createCaptchaCode());
  }, []);

  useEffect(() => {
    drawCaptcha(captchaCode);
  }, [captchaCode, drawCaptcha]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!studentId || !password || !verificationCode) {
      setError("Please fill in all required fields");
      return;
    }

    if (verificationCode.toUpperCase() !== captchaCode) {
      setError("Invalid verification code");
      regenerateCaptcha(); // Refresh captcha on failure
      return;
    }

    const result = await register({
      username: studentId,
      password,
      name: studentId,
      email, // Email is now optional, passed as empty string if not provided
      verificationCode, // Note: Backend ignores this currently, but frontend validation passed
    });

    if (result.success) {
      navigate("/pending-review");
    } else {
      setError(result.error);
      regenerateCaptcha(); // Refresh captcha on error
    }
  };

  let animationClass = "";
  if (location.state?.from === "login") {
    animationClass = "animate-slide-in-right";
  } else if (location.state?.from === "docs") {
    animationClass = "animate-slide-in-left";
  } else if (location.state?.from === "register") {
    animationClass = "animate-slide-in-right";
  }

  return (
    <div
      className="bg-bg-100 text-text-100 font-ui min-h-screen flex flex-col justify-end"
      data-theme="claude"
    >
      <div
        className="text-text-100 min-h-screen flex flex-col justify-end"
        data-theme="claude"
      >
        <div className="mb-32 md:mb-48">
          {/* Navigation Bar */}
          <nav className="fixed top-0 left-0 right-0 w-full bg-bg-100 z-50">
            <div
              className="flex items-center justify-between max-w-[90rem] mx-auto pl-8"
              style={{
                width:
                  "calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))",
              }}
            >
              <div className="flex items-center">
                <a
                  href="#"
                  className="flex items-center gap-[0.5rem] py-[1.375rem]"
                >
                  <img
                    src="/logo.svg"
                    alt="Appointer Logo"
                    className="w-[2.5rem] h-[2.5rem] object-contain"
                  />
                  <span className="text-[1.5rem] font-display font-medium text-text-0 tracking-tight">
                    Appointer
                  </span>
                </a>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() =>
                    navigate("/docs", { state: { from: "register" } })
                  }
                  className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-all will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 h-9 px-5 rounded-lg min-w-[7rem] whitespace-nowrap bg-bg-100 text-text-100 border border-border-200 text-[15px] hover:border-border-200 hover:bg-bg-150"
                >
                  Docs
                </button>
                <button
                  onClick={() =>
                    navigate("/login", { state: { from: "register" } })
                  }
                  className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-9 px-5 rounded-lg min-w-[7rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-[15px]"
                >
                  Log in
                </button>
              </div>
            </div>
          </nav>

          <div className="h-[4.5rem] min-[1000px]:h-[6.25rem]"></div>

          {/* Main Content */}
          <div
            className={`font-ui mx-auto flex w-full grow flex-col justify-center max-w-3xl min-[1000px]:max-w-[90rem] ${animationClass}`}
            style={{
              width:
                "calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))",
            }}
          >
            <main className="flex justify-center items-center min-h-[80vh]">
              {/* Centered Register Card */}
              <div className="w-full max-w-md">
                <h2 className="text-center text-text-100 font-display mt-12 min-[500px]:text-[3.5rem] min-[350px]:text-[3.2rem] text-[1.75rem] select-none leading-none mb-4">
                  Join Us
                </h2>
                <h3 className="flex flex-col gap-[0.3em] sm:gap-[0.15em] items-center text-center text-text-100 font-normal text-pretty font-response mt-4 break-words leading-[1em] text-base md:text-lg leading-snug mb-8">
                  Create your account to get started
                </h3>
                {/*register card*/}
                <div className="mt-8 mx-4 sm:mx-auto p-7 max-w-md min-w-xs text-center border border-border-100 rounded-[2rem] flex flex-col bg-bg-100 shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02)] space-y-2">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 text-left">
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="Student ID"
                        className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email (Optional)"
                        className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <input
                        type="password"
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        placeholder="Repeat Password"
                        className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
                      />
                    </div>
                    <div className="flex flex-row gap-2 text-left items-center">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter CAPTCHA"
                        className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full flex-grow"
                      />
                      <canvas
                        ref={canvasRef}
                        width="100"
                        height="44"
                        onClick={regenerateCaptcha}
                        className="border border-border-300 rounded-[0.6rem] cursor-pointer hover:border-border-200 transition-colors"
                        title="Click to refresh"
                      />
                    </div>

                    {error && (
                      <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-[0.6rem] px-3 py-2">
                        {error}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-11 rounded-[0.6rem] px-5 min-w-[6rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-base can-focus"
                      >
                        Register
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
