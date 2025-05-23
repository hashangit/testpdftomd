"use client";

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Extract2MDConverter, { type ProgressReport } from 'extract2md'; // Assuming ProgressReport is now available from the .d.ts file

const PdfConverterPage: React.FC = () => {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [ocrLanguage, setOcrLanguage] = useState<string>('eng');
    const [markdownOutput, setMarkdownOutput] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [staticProgressMessage, setStaticProgressMessage] = useState<string>('Please select a PDF file, choose OCR language, and click "Process PDF".');
    const [originalFileName, setOriginalFileName] = useState<string>('converted');
    
    const converterRef = useRef<Extract2MDConverter | null>(null);
    const [converterInitialized, setConverterInitialized] = useState<boolean>(false);
    const [initializationError, setInitializationError] = useState<string>('');
    const DEFAULT_LLM_MODEL = 'Qwen3-0.6B-q4f16_1-MLC';

    useEffect(() => {
        try {
            // IMPORTANT: Paths now reference the public folder
            const instance = new Extract2MDConverter({
                pdfJsWorkerSrc: '/extract2md_assets/pdf.worker.min.mjs', // Corrected to .mjs
                tesseractWorkerPath: '/extract2md_assets/assets/tesseract-worker.min.js',
                tesseractCorePath: '/extract2md_assets/assets/tesseract-core.wasm.js',
                tesseractLangPath: '/extract2md_assets/assets/lang-data/',
                splitPascalCase: false,
                llmModel: DEFAULT_LLM_MODEL, // Explicitly set the LLM model
                progressCallback: (progressInfo: ProgressReport) => {
                    console.log(`[UI Progress] ${progressInfo.stage}: ${progressInfo.message}`, progressInfo.progress !== undefined ? (progressInfo.progress * 100).toFixed(1) + '%' : '');
                    setProgressMessage(`${progressInfo.message}${progressInfo.progress !== undefined ? ` (${(progressInfo.progress * 100).toFixed(0)}%)` : ''}`);
                }
            });
            converterRef.current = instance;
            setConverterInitialized(true);
            console.log('Extract2MDConverter initialized successfully');
        } catch (err) {
            console.error("Failed to initialize Extract2MDConverter:", err);
            const errorMsg = `Error: Could not initialize PDF converter. Ensure 'extract2md' is installed and assets are correctly placed in public/extract2md_assets/. Details: ${err instanceof Error ? err.message : String(err)}`;
            setInitializationError(errorMsg);
            setStaticProgressMessage(errorMsg);
        }
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            setPdfFile(file);
            setOriginalFileName(file.name.substring(0, file.name.lastIndexOf('.')) || 'converted');
            setMarkdownOutput('');
            setStaticProgressMessage(`File selected: ${file.name}. Ready to process.`);
            setProgressMessage('');
        } else {
            setPdfFile(null);
            setStaticProgressMessage('No file selected. Please select a PDF file.');
        }
    };

    const handleProcessPdf = async () => {
        if (!pdfFile) {
            alert('Please select a PDF file first.');
            return;
        }
        if (!converterRef.current || !converterInitialized) {
             alert(`Converter not initialized. ${initializationError || 'Please wait or check console for errors.'}`);
             return;
        }

        setIsProcessing(true);
        setMarkdownOutput('');
        setStaticProgressMessage('');
        setProgressMessage('Starting processing...');

        try {
            setProgressMessage(`Extracting text using high-accuracy OCR (lang: ${ocrLanguage})...`);
            
            const highAccuracyText = await converterRef.current.highAccuracyConvert(pdfFile, {
                 tesseractLanguage: ocrLanguage,
            });
            
            setProgressMessage('Text extracted. Now rewriting with LLM...');
            
            try {
                console.log('About to call llmRewrite with text length:', highAccuracyText.length);
const finalMarkdown = await converterRef.current.llmRewrite(highAccuracyText, {
                    llmModel: DEFAULT_LLM_MODEL,
                     chatOpts: {
                        // Options that may be passed to WebLLM's ChatModule
                        temperature: 0.7,
                        max_gen_len: 2048,
                    }
                });
                console.log('llmRewrite completed successfully');
                setMarkdownOutput(finalMarkdown);
            } catch (llmError) {
                console.error('LLM rewrite failed, falling back to original text:', llmError);
                // Fallback to original text if LLM fails
                setMarkdownOutput(highAccuracyText);
                setProgressMessage('LLM rewrite failed, using OCR text directly.');
            }
            setProgressMessage('Processing complete!');
            
            await converterRef.current.unloadLLM();
            setProgressMessage('Processing complete! LLM resources released.');

            setTimeout(() => { 
                 setStaticProgressMessage('Processing complete. View or download the Markdown.');
                 setProgressMessage('');
            }, 2000);

        } catch (error) {
            console.error('Error during PDF processing:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setMarkdownOutput(`An error occurred: ${errorMessage}`);
            setProgressMessage('Error during processing.');
            setStaticProgressMessage(`An error occurred. Details: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadMarkdown = () => {
        if (!markdownOutput) {
            alert('No Markdown content to download.');
            return;
        }
        const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${originalFileName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <Head>
                <title>PDF to Markdown Converter (extract2md) - Next.js</title>
                <meta name="description" content="Upload PDF, extract text with high-accuracy OCR, and rewrite with LLM using extract2md in a Next.js app." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" /> {/* Next.js default, you can change this */}
            </Head>
            <div className="container">
                <header>
                    <h1>PDF to Markdown Converter</h1>
                    <p>Upload a PDF, extract text with high-accuracy OCR (select language), and optionally rewrite it using an LLM for a polished Markdown output.</p>
                </header>

                <main>
                    <section className="upload-section card" aria-labelledby="upload-heading">
                        <h2 id="upload-heading">1. Upload PDF & Configure</h2>
                        <div className="form-group">
                            <label htmlFor="pdf-file-input">PDF File:</label>
                            <input type="file" id="pdf-file-input" accept=".pdf" aria-label="PDF file input" onChange={handleFileChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ocr-language-select">OCR Language:</label>
                            <select id="ocr-language-select" aria-label="OCR Language Selection" value={ocrLanguage} onChange={(e) => setOcrLanguage(e.target.value)}>
                                <option value="eng">English (eng)</option>
                                <option value="sin">Sinhala (sin)</option>
                            </select>
                        </div>
                        <button id="process-pdf-button" className="button primary-button" onClick={handleProcessPdf} disabled={isProcessing || !pdfFile || !converterInitialized || !!initializationError}>
                            {isProcessing ? 'Processing...' : 'Process PDF'}
                        </button>
                        {initializationError && <p style={{color: 'red', marginTop: '10px'}}>{initializationError}</p>}
                    </section>

                    <section className="progress-section card" aria-live="polite">
                        <h2>Processing Status</h2>
                        {(isProcessing || progressMessage) && (
                            <div id="progress-indicator" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
                                <div className="spinner"></div>
                                <span id="progress-message">{progressMessage}</span>
                            </div>
                        )}
                        {staticProgressMessage && !progressMessage && (
                             <p id="static-progress-message" style={{color: staticProgressMessage.startsWith('Error:') ? 'red' : undefined}}>
                                {staticProgressMessage}
                             </p>
                        )}
                    </section>

                    <section className="output-section card" aria-labelledby="output-heading">
                        <h2 id="output-heading">2. Output Markdown</h2>
                        <textarea id="markdown-output" rows={15} readOnly aria-label="Generated Markdown output" value={markdownOutput}></textarea>
                        <button id="download-markdown-button" className="button secondary-button" onClick={handleDownloadMarkdown} disabled={!markdownOutput || isProcessing}>
                            Download Markdown
                        </button>
                    </section>
                </main>

                <footer>
                    <p>Powered by the <a href="https://www.npmjs.com/package/extract2md" target="_blank" rel="noopener noreferrer">extract2md</a> library.</p>
                    {/*
                      FIX: The error "Property 'children' is missing in type '{}' but required in type '{ children: React.ReactNode; }'"
                      on the <small> tag suggests that TypeScript believes the 'children' prop must be explicitly passed in the props object,
                      rather than as nested JSX content. This can happen due to an incorrect global type definition for JSX.IntrinsicElements.small
                      or a similar type system issue.
                      To resolve this, we explicitly pass the text content as a 'children' prop to the <small> tag.
                    */}
                    <p><small>{`Ensure 'extract2md' assets are correctly placed in the 'public/extract2md_assets' folder.`}</small></p>
                </footer>
            </div>
        </>
    );
};

export default PdfConverterPage;