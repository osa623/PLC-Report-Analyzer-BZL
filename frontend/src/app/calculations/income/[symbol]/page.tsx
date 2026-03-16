import { SymbolProvider } from "@/lib/SymbolContext";
import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/CalculationsNav";
import CalculationsSubNav from "@/components/Ui/Stocks/CalculationsSubNav";
import IncomeST from "@/components/Pages/Calculations/IncomeST";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function CalcIncomePage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <SymbolProvider symbol={symbol}>
            <main className="min-h-screen text-white">
                <div className="container mx-auto px-6 py-8 space-y-8">
                    <MainNav />
                    <SecondaryNav />
                    <CalculationsSubNav />
                    <IncomeST symbol={symbol} />
                </div>
            </main>
        </SymbolProvider>
    );
}
