import { useEffect, useState } from 'react';

const steps = [
  '주머니 장소를 살펴보는 중',
  '도착·복귀와 끼니를 맞추는 중',
  '동선을 최적화하는 중',
  '일정을 저장하는 중',
];

function OptimizeWait() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }, 2800);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="optimize-wait" role="status" aria-live="polite" aria-busy="true">
      <div className="optimize-wait-card">
        <span className="loading-spinner-mark" aria-hidden="true" />
        <p className="optimize-wait-title">
          최적화 중<span className="optimize-wait-dots" aria-hidden="true" />
        </p>
        <p className="optimize-wait-step">{steps[step]}</p>
      </div>
    </div>
  );
}

export default OptimizeWait;
