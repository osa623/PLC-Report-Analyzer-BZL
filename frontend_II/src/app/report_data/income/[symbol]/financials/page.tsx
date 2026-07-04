import { SymbolProvider } from "@/lib/SymbolContext";
import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/Report_DataNav";
import IncomeSubNav from "@/components/Ui/Stocks/IncomeSubNav";
import IncomeST from "@/components/Pages/ReportData/IncomeST";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function IncomeStatementPage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <SymbolProvider symbol={symbol}>
            <main className="min-h-screen  bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] text-white">
                <div className="container mx-auto px-6 py-8 space-y-8">
                    <MainNav />
                    <SecondaryNav />
                    <IncomeSubNav />
                    <IncomeST symbol={symbol} />
                </div>
            </main>
        </SymbolProvider>
    );
}
