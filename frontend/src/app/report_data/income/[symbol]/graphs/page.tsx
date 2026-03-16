import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/Report_DataNav";
import IncomeSubNav from "@/components/Ui/Stocks/IncomeSubNav";
import IncomeGraphsClient from "../../graphs/page";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function IncomeGraphsSymbolPage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <main className="min-h-screen text-white">
            <div className="container mx-auto px-6 py-8 space-y-8">
                <MainNav />
                <SecondaryNav />
                <IncomeSubNav />
                <IncomeGraphsClient />
            </div>
        </main>
    );
}
