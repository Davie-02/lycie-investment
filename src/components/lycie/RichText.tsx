import { Fragment, memo } from "react";
import { parseRichText, type Inline } from "@/utils/richText";

function renderInline(parts: Inline[]) {
  return parts.map((part, i) => {
    if (part.type === "bold") return <strong key={i}>{part.text}</strong>;
    if (part.type === "link") {
      const external = part.href.startsWith("http");
      return (
        <a key={i} href={part.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {part.text}
        </a>
      );
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}

/** Lycie's reply, laid out as paragraphs, lists, bold and tappable contact details. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((block, i) => {
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type;
          return (
            <List key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default memo(RichText);
