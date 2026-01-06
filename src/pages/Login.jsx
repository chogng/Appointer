import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await login(username, password);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error);
    }
  };

  let animationClass = "";
  if (location.state?.from === "register") {
    animationClass = "animate-slide-in-left";
  } else if (location.state?.from === "docs") {
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
                    className="w-[1.75rem] h-[1.75rem] object-contain"
                  />
                  <span className="text-[2rem] font-display font-medium text-text-0 tracking-tight">
                    Appointer
                  </span>
                </a>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() =>
                    navigate("/docs", { state: { from: "login" } })
                  }
                  className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-all will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 h-9 px-5 rounded-lg min-w-[7rem] whitespace-nowrap bg-bg-100 text-text-100 border border-border-200 text-[15px] hover:border-border-200 hover:bg-bg-150"
                >
                  Docs
                </button>
                <button
                  onClick={() =>
                    navigate("/register", { state: { from: "login" } })
                  }
                  className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-9 px-5 rounded-lg min-w-[7rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-[15px]"
                >
                  Sign up
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
            <main className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2">
              {/* Left Column: Login Form */}
              <div className="flex items-center w-full py-6 min-h-[89vh]">
                <div className="flex flex-col h-full w-full items-center justify-between">
                  <div></div>
                  <div className="w-full max-w-md">
                    <h2 className="text-center text-text-100 font-display mt-12 min-[500px]:text-[3.5rem] min-[350px]:text-[3.2rem] text-[1.75rem] select-none leading-none mb-4">
                      Inefficient?
                      <br />
                      Efficient.
                    </h2>
                    <h3 className="flex flex-col gap-[0.3em] sm:gap-[0.15em] items-center text-center text-text-100 font-normal text-pretty font-response mt-4 break-words leading-[1em] text-base md:text-lg leading-snug mb-8">
                      The booking system for efficient management
                    </h3>
                    {/*login card*/}
                    <div className="mt-8 mx-4 sm:mx-auto p-7 max-w-md min-w-xs text-center border border-border-100 rounded-[2rem] flex flex-col bg-bg-100 shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02)] space-y-2">
                      <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-4"
                      >
                        <div className="flex flex-col gap-1 text-left">
                          <input
                            id="account"
                            type="account"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your account"
                            className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
                          />
                        </div>
                        <div className="text-center text-text-300 text-xs">
                          AND
                        </div>
                        {/*password*/}
                        <div className="flex flex-col gap-1 text-left">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="bg-bg-0 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-400 can-focus h-11 px-3 rounded-[0.6rem] w-full"
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
                            Continue
                          </button>
                          <div className="text-center">
                            <div className="text-xs text-text-400 leading-relaxed">
                              By continuing, you acknowledge Appointer's{" "}
                              <a
                                href="#"
                                className="inline underline underline-offset-[3px] decoration-text-400/40 hover:decoration-text-400 cursor-pointer"
                              >
                                Privacy Policy
                              </a>{" "}
                              and agree to get occasional product update and
                              promotional emails.
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="mt-14"></div>
                </div>
              </div>

              {/* Right Column: Media Area */}
              <div className="hidden min-[500px]:flex justify-center items-center w-full">
                <div className="hidden min-[1000px]:flex rounded-2xl w-full h-[85vh] min-h-[500px] justify-center items-center overflow-hidden mb-8 bg-[#D97757] shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Placeholder for video/image */}
                    <video
                      src="/claude_login.mp4"
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
