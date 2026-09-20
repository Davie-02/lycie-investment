import { Fragment } from "react";
import { splitPhones } from "@/utils/phones";

/**
 * Renders one or more phone numbers, each tappable to call. A single number is
 * never broken across lines (spaces inside it are non-breaking); `stacked`
 * puts each number on its own line.
 */
export default function PhoneLinks({ value, separator = " · ", stacked = false }: { value: string; separator?: string; stacked?: boolean }) {
  return (
    <>
      {splitPhones(value).map((phone, i) => {
        const text = phone.label.replace(/ /g, " ");
        const node = phone.href ? <a href={phone.href}>{text}</a> : text;
        return (
          <Fragment key={phone.label}>
            {i > 0 && (stacked ? <br /> : separator)}
            {node}
          </Fragment>
        );
      })}
    </>
  );
}
