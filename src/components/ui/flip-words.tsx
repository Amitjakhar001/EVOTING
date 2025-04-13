//src/components/ui/flip-words.tsx

"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, LayoutGroup, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export const FlipWords = ({
  words,
  duration = 3000,
  className,
}: {
  words: string[];
  duration?: number;
  className?: string;
}) => {
  const [currentWord, setCurrentWord] = useState(words[0]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // thanks for the fix Julian - https://github.com/Julian-AT
  const startAnimation = useCallback(() => {
    const word = words[words.indexOf(currentWord) + 1] || words[0];
    setCurrentWord(word);
    setIsAnimating(true);
  }, [currentWord, words]);

  useEffect(() => {
    if (!isAnimating)
      setTimeout(() => {
        startAnimation();
      }, duration);
  }, [isAnimating, duration, startAnimation]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        setIsAnimating(false);
      }}
    >
      <MotionDiv
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 10,
        }}
        exit={{
          opacity: 0,
          y: -40,
          x: 40,
          filter: "blur(8px)",
          scale: 2,
          position: "absolute",
        }}
        className={cn(
        //   "z-10 inline-block relative text-left text-neutral-900 dark:text-neutral-100 px-2",
        "z-10 inline-block relative text-left text-blue-300 px-2",
          className
        )}
        key={currentWord}
      >
        {/* edit suggested by Sajal: https://x.com/DewanganSajal */}
        {currentWord.split(" ").map((word, wordIndex) => (
          <MotionSpan
            key={word + wordIndex}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: wordIndex * 0.3,
              duration: 0.3,
            }}
            className="inline-block whitespace-nowrap"
          >
            {word.split("").map((letter, letterIndex) => (
              <MotionSpan
                key={word + letterIndex}
                initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: wordIndex * 0.3 + letterIndex * 0.05,
                  duration: 0.2,
                }}
                className="inline-block"
              >
                {letter}
              </MotionSpan>
            ))}
            <span className="inline-block">&nbsp;</span>
          </MotionSpan>
        ))}
      </MotionDiv>
    </AnimatePresence>
  );
};


// Create a type-safe Motion Div wrapper
interface MotionDivProps extends HTMLMotionProps<'div'> {
    className?: string;
  }
  
  const MotionSpan: React.FC<MotionDivProps> = ({ 
    className, 
    ...props 
  }) => {
    return (
      <motion.span
        className={className}
        {...props as any}
      />
    );

    
  };

  const MotionDiv: React.FC<MotionDivProps> = ({ 
    className, 
    ...props 
  }) => {
    return (
      <motion.div
        className={className}
        {...props as any}
      />
    );

    
  };