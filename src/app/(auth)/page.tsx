// import HomeCard from "@/app/(nav-pages)/home/components/HomeCard";

import { Metadata } from "next";
import { redirect } from "next/navigation";

export default function Home() {
  // redirects to leaderboard but middleware will redirect to login if not logged in
  redirect("/leaderboard")
  
  // return (
  //   <div className="flex flex-col justify-center md:gap-10 md:m-7">
  //       {/* <UnderConstruction /> */}
  //       {/* <HomeCard className=""/> */}
  //       <div className="flex flex-col md:flex-row items-center md:items-start m-7 md:m-0 gap-10 md:gap-30">
  //         {/* What is CSA? */}
  //         <div className="flex flex-col gap-3 lg:gap-5">
  //           <h2 className="text-2xl lg:text-4xl font-primary"><u>What is CSA?</u></h2>
  //           <p className="text-base lg:text-2xl">
  //             Established in 1963, the Texas A&M Chinese Student Association (CSA) is a welcoming community that serves our university through social and cultural Chinese experiences. In CSA, we aim to create lifelong friendships and memories through our general meetings and events. We are excited to help you find your place at Texas A&M!
  //           </p>
  //         </div>
  //         <iframe className="aspect-video sm:w-md md:w-xs lg:w-sm xl:w-md rounded-xl" src="https://www.youtube.com/embed/V1482ryyZcc?si=sWGN36cdfbvTGZPW" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
  //       </div>
  //   </div>
  // );
}

export const metadata: Metadata = {
  title: "TAMU CSA - Points",
  description: "The point tracking system for the Texas A&M Chinese Student Association.",
};
