//src/components/images.tsx

import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";

export function AnimatedTestimonialsDemo() {
  const testimonials = [
     
    {
      quote:
        "The attention to detail and innovative features have completely transformed our workflow. This is exactly what we've been looking for.",
      name: "IIT Bhilai",
      designation: "Indian Institute of technology, Bhilai : Chhattisgarh",
      src: "/iitbhilai.png",
    },
    {
      quote:
        "write here ...........  wait!",
      name: "Dr. Souryadyuti Paul ",
      designation: "Associate Professor, Head of CSE Department, IIT Bhilai",
      src: "/drpaul.png",
    },
    {
        quote:
          "write here   ....   wait !",
        name: "Evoting System",
        designation: "Using Blockchain technology",
        src: "/blockchain.jpg",
      },
    // {
    //   quote:
    //     "This solution has significantly improved our team's productivity. The intuitive interface makes complex tasks simple.",
    //   name: "Ankit Jakhar",
    //   designation: "Junior Developers , IIT bhilai",
    //   src: "/jb.png",
    // },
  
  ];
  return <AnimatedTestimonials testimonials={testimonials} autoplay={true}/>;
}