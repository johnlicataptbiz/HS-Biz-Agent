import React, { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles, BrainCircuit } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'right' | 'left' | 'top' | 'bottom' | 'center';
  route?: string; // Tab to switch to
}

interface AppTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigate: (tab: string) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'center-screen',
    title: 'Core UI by PT Biz',
    description: 'Welcome. I am the Core Intelligence Assistant. This is your command center for high-velocity practice growth and CRM operations.',
    position: 'center'
  },
  {
    targetId: 'connection-status',
    title: 'HubSpot Pulse',
    description: 'We maintain a live link with your CRM database, monitoring health indices in real-time to ensure maximum operational efficiency.',
    position: 'right'
  },
  {
    targetId: 'launch-audit-btn', 
    title: 'Strategic Audit',
    description: 'Run deep heuristics on your portal to identify ghost enrollments, architectural debt, and data decay instantly.',
    position: 'bottom',
    route: 'dashboard'
  },
  {
    targetId: 'stat-revenue-risk',
    title: 'Growth Leakage',
    description: 'We track potential revenue stalled in your journey stages. Our target is zero leakage and maximum practice scale.',
    position: 'bottom',
    route: 'dashboard'
  },
  {
    targetId: 'nav-link-journey',
    title: 'Behavioral Journey',
    description: 'Visualize the flow of leads—from cold contacts to active members. We find exactly where the pipeline is breaking.',
    position: 'right',
    route: 'journey'
  },
  {
    targetId: 'nav-link-contacts',
    title: 'Database Brain',
    description: 'Our AI classification engine organizes your lead database into actionable cohorts: New, Active Member, and Nurture.',
    position: 'right',
    route: 'contacts'
  },
  {
    targetId: 'nav-link-copilot',
    title: 'Core Strategist',
    description: 'Need a tactical plan? Your Practice Strategist is ready. It doesn\'t just chat—it executes CRM and operational improvements.',
    position: 'right',
    route: 'copilot'
  },
  {
    targetId: 'ai-chat-trigger',
    title: 'AI Command',
    description: 'Trigger the global AI assistant from anywhere to perform mass updates or architectural audits.',
    position: 'left'
  }
];

const AppTour: React.FC<AppTourProps> = ({ isOpen, onClose, onComplete, onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleStepChange(currentStep);
      window.addEventListener('resize', () => {
         // simple refresh
         handleStepChange(currentStep);
      });
      return () => window.removeEventListener('resize', () => {});
    }
  }, [isOpen, currentStep]);

  const handleStepChange = (stepIdx: number) => {
      const step = TOUR_STEPS[stepIdx];
      
      // 1. Navigation Logic
      if (step.route) {
          onNavigate(step.route);
          // Wait for render
          setTimeout(() => updatePosition(step.targetId), 400); 
      } else {
          updatePosition(step.targetId);
      }
  };

  const updatePosition = (targetId: string) => {
    if (targetId === 'center-screen') {
        setTargetRect(null);
        return;
    }

    const findAndSet = () => {
        const element = document.getElementById(targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
    };

    // Immediate check
    if (!findAndSet()) {
       // Poll for it (since route change might fade in)
       let attempts = 0;
       const interval = setInterval(() => {
           if (findAndSet() || attempts > 5) clearInterval(interval);
           attempts++;
       }, 200);
    }
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Calculate Popover Position with Boundary Detection
  const getPopoverStyle = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 20;
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT = 200; // Approx height
    const SCREEN_PADDING = 20;

    let top = 0;
    let left = 0;
    let newPos = step.position;

    // Helper to check if rect fits
    const checkFit = (t: number, l: number) => {
        return (
            t >= SCREEN_PADDING &&
            l >= SCREEN_PADDING &&
            t + POPOVER_HEIGHT <= window.innerHeight - SCREEN_PADDING &&
            l + POPOVER_WIDTH <= window.innerWidth - SCREEN_PADDING
        );
    };

    // calculate initial coords based on preferred position
    const getCoords = (pos: string) => {
        switch (pos) {
            case 'right':
                return {
                    top: targetRect.top + (targetRect.height / 2) - 100,
                    left: targetRect.right + gap
                };
            case 'left':
                return {
                    top: targetRect.top + (targetRect.height / 2) - 100,
                    left: targetRect.left - gap - POPOVER_WIDTH
                };
            case 'bottom':
                return {
                    top: targetRect.bottom + gap,
                    left: targetRect.left + (targetRect.width / 2) - (POPOVER_WIDTH / 2)
                };
            case 'top':
                return {
                    top: targetRect.top - gap - POPOVER_HEIGHT,
                    left: targetRect.left + (targetRect.width / 2) - (POPOVER_WIDTH / 2)
                };
            default:
                return { top: 0, left: 0 };
        }
    };

    let coords = getCoords(newPos);

    // Auto-flip logic
    if (!checkFit(coords.top, coords.left)) {
        const flipMap: Record<string, string> = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
        if (flipMap[newPos]) {
            const flippedCoords = getCoords(flipMap[newPos]);
            // If flipped fits better (or at least valid X/Y), use it
            // We favor the one that is mostly on screen
            if (checkFit(flippedCoords.top, flippedCoords.left)) {
                coords = flippedCoords;
            }
        }
    }

    // Safety Clamp (ensure it never goes fully off screen)
    coords.top = Math.max(SCREEN_PADDING, Math.min(coords.top, window.innerHeight - POPOVER_HEIGHT - SCREEN_PADDING));
    coords.left = Math.max(SCREEN_PADDING, Math.min(coords.left, window.innerWidth - POPOVER_WIDTH - SCREEN_PADDING));

    return {
        top: coords.top,
        left: coords.left
    };
  };

  return (
    <div className="fixed inset-0 z-[100] animate-in fade-in duration-500 font-['Outfit']">
      
      {/* 1. Spotlight Overlay (SVG Mask) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {targetRect && (
              <rect 
                x={targetRect.left - 5} 
                y={targetRect.top - 5} 
                width={targetRect.width + 10} 
                height={targetRect.height + 10} 
                rx="8" 
                fill="black" 
                className="transition-all duration-500 ease-in-out"
              />
            )}
          </mask>
        </defs>
        <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="rgba(15, 23, 42, 0.85)" 
            mask="url(#spotlight-mask)" 
        />
        
        {/* Glowing border around target */}
        {targetRect && (
            <rect 
                x={targetRect.left - 5}
                y={targetRect.top - 5}
                width={targetRect.width + 10}
                height={targetRect.height + 10}
                rx="8"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                className="transition-all duration-500 ease-in-out animate-pulse"
            />
        )}
      </svg>

      {/* 2. Interactive Card */}
      <div 
        className="absolute transition-all duration-500 ease-in-out w-[320px]"
        style={getPopoverStyle()}
      >
        <div className="glass-card border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.2)] p-6 relative overflow-hidden bg-[#0a0f1d]/90 backdrop-blur-xl">
           {/* Background Deco */}
           <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>

           <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                   <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                       <BrainCircuit size={20} />
                   </div>
                   <button onClick={onClose} title="Dismiss Tour" className="text-slate-500 hover:text-white transition-colors">
                       <X size={16} />
                   </button>
               </div>

               <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-6">
                   {step.description}
               </p>

               <div className="flex items-center justify-between">
                   <div className="flex gap-1">
                       {TOUR_STEPS.map((_, idx) => (
                           <div 
                             key={idx} 
                             className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-700'}`} 
                           />
                       ))}
                   </div>

                   <button 
                     onClick={() => {
                         if (isLastStep) {
                             onComplete();
                         } else {
                             setCurrentStep(prev => prev + 1);
                         }
                     }}
                     className="px-4 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 transition-colors flex items-center gap-2"
                   >
                       {isLastStep ? 'Finish' : 'Next'} <ArrowRight size={12} />
                   </button>
               </div>
           </div>
        </div>
      </div>

    </div>
  );
};

export default AppTour;
