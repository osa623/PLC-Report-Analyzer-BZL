import { motion } from "framer-motion";
import { ArrowRight, FileText, Shield, Zap } from "lucide-react";

const features = [
  { icon: Zap, label: "Instant extraction" },
  { icon: FileText, label: "Multi-format support" },
  { icon: Shield, label: "Bank-grade security" },
];

const AnnualReportWidget = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-auto relative group"
    >
      {/* Outer glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#DFBD69]/40 via-[#B28D41]/10 to-transparent  group-hover:opacity-100 transition-opacity duration-700 blur-sm" />

     <div className="relative w-[1000px] flex">
      <div className="relative rounded-l-2xl rounded-tr-2xl w-[340px] bg-[#131B2C]/90 backdrop-blur-xl  overflow-hidden">
        {/* Top accent line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#DFBD69] to-transparent" />

        {/* Badge */}
        <div className="px-6 pt-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DFBD69]/10 border border-[#DFBD69]/20 text-[11px] font-semibold tracking-widest uppercase text-[#DFBD69]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DFBD69] animate-pulse" />
            Premium
          </span>
        </div>

        {/* Title block */}
        <div className="px-6 pt-4 pb-2">
          <h3 className="text-[35px] tracking-normal font-bold font-fugaz leading-tight text-white tracking-tight">
            ANNUAL REPORT
          </h3>
          <p className="text-xl font-semibold font-fugaz tracking-normal uppercase text-[#B28D41] mt-0.5">
            EXTRACTOR
          </p>
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="text-sm leading-relaxed text-gray-400">
            Automatically extract and analyze financial data from annual reports in seconds.
          </p>
        </div>

        {/* Features 
        <div className="px-6 pb-5 flex flex-col gap-2.5">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-[#182847]/80 border border-[#306B99]/20 flex items-center justify-center">
                <f.icon className="w-3.5 h-3.5 text-[#E9D37E]" />
              </div>
              <span className="text-xs font-medium text-gray-300">{f.label}</span>
            </motion.div>
          ))}
        </div>*/}

        {/* Divider */}
        <div className="mx-6 h-px bg-[#306B99]/20" />

        {/* Pricing & CTA */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-end gap-1.5">
            <span className="flex font-fugaz text-5xl font-bold text-white"><h2 className='text-xs inline'>Rs </h2>4,999</span>
            <span className="text-xs text-gray-500 font-medium">/month</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center cursor-pointer justify-center gap-2 bg-gradient-to-r from-[#B28D41] to-[#E9D37E] hover:shadow-lg hover:shadow-[#B28D41]/30 text-[#0D1325] font-semibold font-encode text-sm py-3 rounded-xl transition-all duration-300"
          >
            Unlock Now
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <p className="text-[11px] text-gray-500 text-center">
            30-day free trial · Cancel anytime
          </p>
        </div>
      </div>
      
      <div className="relative w-[340px] ">
        <div className="absolute w-40 h-40 rounded-r-2xl bottom-0 bg-[#131B2C]/90">

        </div>

        <div className="relative w-full h-full  bg-transparent">


        </div>


      </div>

      </div>

    </motion.div>
  );
};

export default AnnualReportWidget;
