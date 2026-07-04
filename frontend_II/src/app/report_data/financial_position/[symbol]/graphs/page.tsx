import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/Report_DataNav";
import FinancialPositionSubNav from "@/components/Ui/Stocks/FinancialPositionSubNav";
import FinancialPositionGraphsClient from "../../graphs/page";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function FinancialPositionGraphsSymbolPage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <main className="min-h-screen  bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] text-white">
            <div className="container mx-auto px-6 py-8 space-y-8">
                <MainNav />
                <SecondaryNav />
                <FinancialPositionSubNav />
                <FinancialPositionGraphsClient />
            </div>
        </main>
    );
}
