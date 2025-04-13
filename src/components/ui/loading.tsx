// src/components/ui/loading.tsx
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface LoadingProps {
  text?: string;
  className?: string;
  size?: number;
  minDuration?: number;
}

export const Loading = ({ 
  text, 
  className = "", 
  size = 24, 
  minDuration = 2000 
}: LoadingProps) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  if (!show) return null;

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      <Loader2 className="animate-spin" size={size} />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
};

export const ButtonLoading = ({ text = "Processing..." }: { text?: string }) => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <Loader2 className="animate-spin" size={16} />
      <span>{text}</span>
    </div>
  );
};

export const PageLoader = () => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Loading text="Loading..." size={32} className="text-white" />
    </div>
  );
};