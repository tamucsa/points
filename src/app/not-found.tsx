import NotFoundBox from "@/app/ui/NotFoundBox";

import { Metadata } from "next";
 
export const metadata: Metadata = {
  title: "TAMU CSA - 404 Not Found",
  description: "404 Not Found - The page you are looking for does not exist.",
};  

export default function NotFound() {
    return (
        <NotFoundBox/>
    )
}