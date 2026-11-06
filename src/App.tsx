import { DataProvider } from "./app/data";
import { Loading } from "./components/ui";

export default function App() {
  return <DataProvider fallback={<Loading text="Đang khởi động…" />}><div /></DataProvider>;
}
