import "./globals.css";

export const metadata = {
  title: "Code Complexity Analyzer — TC & SC Predictor",
  description:
    "Paste C/C++ code and instantly get Big-O time & space complexity with step-by-step explanations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
