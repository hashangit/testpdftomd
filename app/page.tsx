"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the client-side component with SSR disabled
const PdfConverterClient = dynamic(() => import('@/components/PdfConverterClient'), {
  ssr: false,
  loading: () => <p>Loading PDF Converter...</p> // Optional loading component
});

const Page: React.FC = () => {
  return <PdfConverterClient />;
};

export default Page;