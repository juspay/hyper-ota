import React, { useEffect } from 'react';
import decorativeImage from '../../assets/login-decorative-image.jpeg';
import smallLogoImage from '../../assets/airborne-cube-logo.png'; // Assuming this is the correct small logo

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  useEffect(() => {
    // Page background gradient
    document.body.classList.add('bg-gradient-to-bl', 'from-slate-900', 'via-indigo-950', 'to-purple-950');
    return () => {
      document.body.classList.remove('bg-gradient-to-bl', 'from-slate-900', 'via-indigo-950', 'to-purple-950');
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans"> {/* Apply Inter font */}
      <div className="bg-gradient-to-br from-indigo-950 via-neutral-900 to-black shadow-2xl rounded-2xl overflow-hidden md:flex max-w-4xl w-full">
        {/* Left Panel */}
        <div className="md:w-1/2 relative hidden md:block">
          <img
            src={decorativeImage}
            alt="Decorative background"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-6 left-6 z-10 flex items-center space-x-2">
            <img src={smallLogoImage} alt="Airborne Small Logo" className="w-7 h-7" />
            <span className="text-white font-semibold text-lg">Airborne</span>
          </div>
        </div>
        {/* Right Panel - Content via children */}
        <div className="md:w-1/2 p-8 sm:p-10 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};
