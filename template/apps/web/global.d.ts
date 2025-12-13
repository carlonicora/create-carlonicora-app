import it from "./messages/it.json";

type Messages = typeof it;

declare global {
  interface IntlMessages extends Messages {}
}
