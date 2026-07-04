import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/RatioNav";
import RatiosSubNav from "@/components/Ui/Stocks/RatiosSubNav";
import RatiosFPGraphsClient from "../../graphs/page";

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function RatiosFPGraphsSymbolPage({ params }: Props) {
    const { symbol: raw } = await params;
    const symbol = decodeURIComponent(raw).toUpperCase();

    return (
        <main className="min-h-screen text-white">
            <div className="container mx-auto px-6 py-8 space-y-8">
                <MainNav />
                <SecondaryNav />
                <RatiosSubNav />
                <RatiosFPGraphsClient />
            </div>
        </main>
    );
}
