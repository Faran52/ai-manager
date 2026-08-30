import { Highlight, themes } from 'prism-react-renderer';

import { uniqueKeys } from '@utils/reactKeyUtils';

import type { FC } from 'react';

export interface CodeBlockProps {
  readonly code: string;
  readonly language: string;
}

export const CodeBlock: FC<CodeBlockProps> = ({ code, language }) => {
  return (
    <Highlight theme={themes.vsDark} code={code} language={language}>
      {({
        style,
        tokens,
        getLineProps,
        getTokenProps,
      }) => {
        const lineKeys = uniqueKeys(tokens, (line) => {
          return line.map((token) => {
            return token.content;
          }).join('\u0000');
        });

        return (
          <pre
            className="overflow-x-auto rounded-lg p-3 text-xs/relaxed"
            style={{
              ...style,
              background: '#18181b',
            }}
          >
            {tokens.map((line, lineIndex) => {
              const tokenKeys = uniqueKeys(line, (token) => {
                return token.content;
              });
              const lineProps = getLineProps({ line });

              return (
                <div key={lineKeys[lineIndex]} {...lineProps}>
                  {line.map((token, tokenIndex) => {
                    const tokenProps = getTokenProps({ token });

                    return <span key={tokenKeys[tokenIndex]} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        );
      }}
    </Highlight>
  );
};
