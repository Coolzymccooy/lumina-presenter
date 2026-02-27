
import React, { useEffect, useState } from 'react';

interface WelcomeAnimationProps {
    onFinish: () => void;
}

export const WelcomeAnimation: React.FC<WelcomeAnimationProps> = ({ onFinish }) => {
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowButton(true);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 animate-in fade-in zoom-in-110"
                style={{ backgroundImage: 'url("/welcome_bg.png")', opacity: 0.6 }}
            />

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80" />

            {/* Confetti Particles (CSS Only) */}
            <div className="absolute inset-0 pointer-events-none">
                {[...Array(60)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute animate-confetti"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10%`,
                            backgroundColor: ['#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#ffffff'][Math.floor(Math.random() * 5)],
                            width: `${Math.random() * 10 + 5}px`,
                            height: `${Math.random() * 10 + 5}px`,
                            opacity: Math.random(),
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${Math.random() * 2 + 3}s`,
                            transform: `rotate(${Math.random() * 360}deg)`,
                        }}
                    />
                ))}
            </div>

            {/* Content */}
            <div className="relative z-10 text-center px-6">
                <div className="mb-6 inline-block">
                    <div className="px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] font-mono">NEURAL HUB // INITIALIZED</span>
                    </div>
                </div>

                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter mb-4 animate-in slide-in-from-bottom-8 duration-1000">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Lumina</span>
                </h1>

                <p className="max-w-md mx-auto text-zinc-400 text-sm md:text-base font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                    Step into the future of sacred presentation. Your studio workspace is ready for your first projection.
                </p>

                {showButton && (
                    <button
                        onClick={onFinish}
                        className="group relative px-10 py-4 bg-white text-black rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/20 animate-in zoom-in-75 duration-500"
                    >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative group-hover:text-white transition-colors">Start Your Journey</span>
                    </button>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation-name: confetti;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}} />
        </div>
    );
};
