'use client'

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";



//imports for Uis
import Waves from '../../Ui/Waves';
import CardSwap, { Card } from '../../Ui/CardSwapI';



//data sets
const serviceDetails = [
  {
    tag: "In-Depth Financial Report Analysis",
    desc: "Unlock the full potential of corporate filings with our sophisticated analysis engine. We go beyond surface-level numbers to dissect complex balance sheets, income statements, and cash flow reports. By identifying underlying trends and accounting nuances, we provide investors with a crystal-clear understanding of a company's operational efficiency and long-term financial health."
  },
  {
    tag: "Interactive Financial Charts & Visuals",
    desc: "Transform raw data into actionable insights through our suite of high-performance interactive visualizations. Our charting tools allow you to overlay multiple technical indicators, compare historical price movements, and visualize volume patterns with precision. Whether you are performing trend analysis or volatility checks, these dynamic visuals make complex market movements intuitive and easy."
  }
];



export default function CompanyProfiles() {


  const [activeIndex, setActiveIndex] = useState(0);


  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % serviceDetails.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);




  return (

    /* Main Section */
    <div className="relative h-screen w-full z-40 bg-transparent">

      {/* Lower div Section for 2 sections */}

      <div className="absolute flex-col flex z-40 h-auto w-full overflow-hidden">


        <div className="relative z-50 flex inset-0 h-screen">
          {/* Wave Patterns */}

          <div className="absolute z-40 opacity-20 w-full h-full">
            <Waves
              lineColor="#fff"
              backgroundColor="transparent"
              waveSpeedX={0.07}
              waveSpeedY={0.01}
              waveAmpX={40}
              waveAmpY={20}
              friction={0.9}
              tension={0.01}
              maxCursorMove={120}
              xGap={12}
              yGap={36}
            />
          </div>
          <div className="absolute opacity-40 z-50 w-full h-full">
            <Waves

              lineColor="#fff"
              backgroundColor="transparent"
              waveSpeedX={0.02}
              waveSpeedY={0.01}
              waveAmpX={40}
              waveAmpY={20}
              friction={0.9}
              tension={0.01}
              maxCursorMove={120}
              xGap={12}
              yGap={36}
            />
          </div>

          {/* white background*/}
          <div className="absolute bg-gradient-to-t  from-[#0b1534] via-[#0D1425] to-transparent z-40 w-full h-full" />
          <div className="absolute bg-gradient-to-t  from-[#0b1534] via-[#0D1425] to-transparent z-50 w-full h-full" />

          {/* Sliding Menu for the Comprehensive Card */}
          <div className="absolute z-50 w-[50%] h-screen bg-transparent top-0 left-0 h-full">
            <div className="" style={{ height: '600px', position: 'relative' }}>
              <CardSwap
                skewAmount={0}
              >
                <Card>
                  <div className="relative h-full border-4 bg-white backdrop-blur-sm rounded-xl overflow-hidden border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">


                  </div>

                </Card>
                <Card>
                  <div className="relative h-full bg-white border-4 backdrop-blur-sm rounded-xl overflow-hidden border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">



                  </div>

                </Card>
              </CardSwap>
            </div>


          </div>

          {/* texting area for the Feature section */}
          <div className="absolute z-50 flex-col top-12 left-1/2 -translate-x-1/2 border-white h-full flex items-center bg-transparent w-[50%] h-f">
            <div className="relative flex h-auto  w-auto">
              <h2 className="absolute flex font-bowlby top-0 md:text-[3rem] md:ml-12 text-white">
                COMPREHENSIVE||||||<div className="relative flex bg-white w-full" />
              </h2>
              <h2 className="absolute font-bowlby md:text-[6rem] top-6   md:ml-12 text-white">
                COMPANY
              </h2>
              <h2 className="absolute font-bowlby md:text-[7.5rem] top-24   md:ml-12 text-white">
                PROFILE
              </h2>


            </div>
          </div>

          {/* data description section */}
          <div className="absolute z-50 bottom-0 right-0 h-full md:p-0 hidden md:flex justify-center items-start bg-transparent md:w-[50%] lg:w-[50%] lg:h-[50vh]">
            <div
              className="relative  flex flex-col h-full w-full p-8 transition-all duration-500"

            >

              {/* Dynamic Content Container */}
              <div
                key={activeIndex}
                className="relative h-full animate-in fade-in lg:mt-6 slide-in-from-bottom-8 duration-700 ease-out"
              >

                {/* 1. The Decorative Lin  (The border) 
          Changed generic border to a glowing blue accent bar */}
                <div className="absolute left-0 top-2 bottom-1/3 w-[3px] bg-gradient-to-b from-blue-500 via-blue-400/50 to-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />

                {/* 2. The Tag 
          Added glassmorphism, a subtle border, and a glow effect */}
                <div className="absolute left-6 -top-1">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-blue-900/40 border border-blue-400/30 backdrop-blur-md text-white font-normal font-fugaz text-[10px] tracking-[0.2em] uppercase shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)]">
                    {serviceDetails[activeIndex].tag}
                  </span>
                </div>


                <div className="pl-6 pt-12 lg:pt-12">
                  <p className="font-encode font-thin text-lg md:text-md text-left text-blue-50/90 leading-relaxed tracking-wide drop-shadow-sm text-pretty">
                    {serviceDetails[activeIndex].desc}
                  </p>


                  <div className="mt-6 w-12 h-0.5 bg-blue-500/30 rounded-full" />
                </div>

              </div>

            </div>
          </div>


          <div className="absolute z-50 flex-col top-40 right-0 border-white h-full flex items-center bg-transparent w-[50%] h-f">
            <div className="relative flex md:mt-12 h-auto w-[100%]">
              <h2 className="flex font-encode bottom-24 md:text-2xl md:mt-20 md:ml-12 text-white/60"
                style={{
                  fontWeight: '100'
                }}>
                Explore detailed profiles of companies with key financial metrics, business insights, and operational highlights to understand their businesses at a glance.
              </h2>
            </div>

          </div>

          {/* Below Line Section */}
          <div className="absolute z-50  bottom-0 w-full h-2 bg-gradient-to-l from-blue-500 via-blue-400/50 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.9)]" />


        </div>

      </div>



    </div>
  );
}
