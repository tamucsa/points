import LinkButton from "@/app/components/ui/LinkButton";

// import classNames from "classnames";

export default function NotFoundBox() {
    return (
        <div className='flex items-center justify-center h-screen'>    
            <div className='flex flex-col mx-5 gap-10 sm:gap-12 lg:gap-7'>
                <div className='flex flex-col lg:flex-row items-center justify-center gap-5 sm:gap-10 lg:gap-20'>
                    {/* Left Text */}
                    <h1 className='text-9xl sm:text-[10rem] leading-none font-primary'>404</h1>
                    {/* Right Text */}
                    <div className="items-center justify-center text-center">
                        <h2 className='text-3xl sm:text-5xl font-secondary'>This page could not be found</h2>
                        <p className='text-base sm:text-xl font-secondary mt-2'>The page you are looking for does not exist or has been moved.</p>
                    </div>
                </div>
                <LinkButton
                    href="/"
                    newTab={false}
                    className="w-full text-3xl lg:text-4xl"
                >
                    Home
                </LinkButton>
            </div>
        </div>
    );
}