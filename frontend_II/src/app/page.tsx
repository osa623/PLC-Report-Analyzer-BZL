import HeroSection from '@/components/Pages/Home/HeroSection';
import CompanySection from '@/components/Pages/Home/CompanyProfiles';
import FinancialReport from '@/components/Pages/Home/FinancialReport';
import FinancialCharts from '@/components/Pages/Home/FinancialCharts';
import FeedbackSection from '@/components/Pages/Home/FeedbackSection';
import MiddleSection1 from '@/components/Pages/Home/MiddleSection1';




export default function Home() {
  return (
    <div className="relative flex flex-col w-full">
      <HeroSection />
      <MiddleSection1 />
      <CompanySection />
    </div>
  );
}