import React from 'react';
import { useNavigate } from 'react-router-dom';

const PendingReview = () => {
    const navigate = useNavigate();

    return (
        <div className='bg-bg-100 text-text-100 font-ui min-h-screen flex flex-col justify-end' data-theme="claude">
            <div className="text-text-100 min-h-screen flex flex-col justify-end" data-theme="claude">
                <div className="mb-32 md:mb-48">
                    {/* Navigation Bar */}
                    <nav className="fixed top-0 left-0 right-0 w-full bg-bg-100 z-50">
                        <div className="flex items-center justify-between max-w-[90rem] mx-auto pl-8" style={{ width: 'calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))' }}>
                            <div className="flex items-center">
                                <a href="#" className="flex items-center gap-[0.5rem] py-[1.375rem]">
                                    <img src="/logo.svg" alt="Appointer Logo" className="w-[2.5rem] h-[2.5rem] object-contain" />
                                    <span className="text-[1.5rem] font-display font-medium text-text-0 tracking-tight">
                                        Appointer
                                    </span>
                                </a>
                            </div>
                            <div className="hidden sm:flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/docs')}
                                    className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-all will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 h-9 px-5 rounded-lg min-w-[7rem] whitespace-nowrap bg-bg-100 text-text-100 border border-border-200 text-[15px] hover:border-border-200 hover:bg-bg-150"
                                >
                                    Docs
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-9 px-5 rounded-lg min-w-[7rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-[15px]"
                                >
                                    Log in
                                </button>
                            </div>
                        </div>
                    </nav>

                    <div className="h-[4.5rem] min-[1000px]:h-[6.25rem]"></div>

                    {/* Main Content */}
                    <div className="font-ui mx-auto flex w-full grow flex-col justify-center max-w-3xl min-[1000px]:max-w-[90rem]" style={{ width: 'calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))' }}>
                        <main className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2">
                            {/* Left Column: Message */}
                            <div className="flex items-center w-full py-6 min-h-[89vh]">
                                <div className="flex flex-col h-full w-full items-center justify-between">
                                    <div></div>
                                    <div className="w-full max-w-md">
                                        <h2 className="text-center text-text-100 font-display mt-12 min-[500px]:text-[3.5rem] min-[350px]:text-[3.2rem] text-[1.75rem] select-none leading-none mb-4">
                                            Reviewing
                                        </h2>
                                        <h3 className="flex flex-col gap-[0.3em] sm:gap-[0.15em] items-center text-center text-text-100 font-normal text-pretty font-response mt-4 break-words leading-[1em] text-base md:text-lg leading-snug mb-8">
                                            Your application is currently under review.
                                        </h3>

                                        <div className="mt-8 mx-4 sm:mx-auto p-7 max-w-md min-w-xs text-center border border-border-100 rounded-[2rem] flex flex-col bg-bg-100 shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02)] space-y-2">
                                            <div className="text-text-300 mb-4">
                                                We will notify you via email once your account is approved.
                                            </div>
                                            <button
                                                onClick={() => navigate('/login')}
                                                className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-11 rounded-[0.6rem] px-5 min-w-[6rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-base can-focus w-full"
                                            >
                                                Back to Login
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-14"></div>
                                </div>
                            </div>

                            {/* Right Column: Media Area */}
                            <div className="hidden min-[500px]:flex justify-center items-center w-full">
                                <div className="hidden min-[1000px]:flex rounded-2xl w-full h-[85vh] min-h-[500px] justify-center items-center overflow-hidden mb-8 bg-[#D97757] shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]">
                                    <div className="relative w-full h-full flex items-center justify-center">
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

export default PendingReview;
