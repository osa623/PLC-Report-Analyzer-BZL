import { SymbolProvider } from "@/lib/SymbolContext";
import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/RatioNav";
import RatiosSubNav from "@/components/Ui/Stocks/RatiosSubNav";
import FinancialPosition from "@/components/Pages/Ratios/financial_position";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function RatioFinancialPositionPage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <SymbolProvider symbol={symbol}>
            <main className="min-h-screen text-white">
                <div className="container mx-auto px-6 py-8 space-y-8">
                    <MainNav />
                    <SecondaryNav />
                    <RatiosSubNav />
                    <FinancialPosition symbol={symbol} />
                </div>
            </main>
        </SymbolProvider>
    );
}
