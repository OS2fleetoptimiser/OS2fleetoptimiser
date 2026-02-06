'use client';

import Page from "@/app/(logged-in)/location/[locationId]/page";

export default function NewLocationPage() {
    return <Page params={Promise.resolve({ locationId: undefined })} />;
}
