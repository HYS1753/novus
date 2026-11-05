import { useUpdateNotice } from "@/features/update-app/model/useUpdates";
export function UpdateNotice({ onOpen }: { onOpen: () => void }) {
  const notice = useUpdateNotice();
  if (!notice) return null;
  const ready = notice.startsWith("ready:");
  return (
    <button className="update-notice" onClick={onOpen} aria-label="업데이트 설정 열기">
      <span aria-hidden="true">↑</span>
      <span>
        {ready ? "업데이트 설치 준비 완료" : "새 업데이트가 있습니다"}
        <small>설정에서 {ready ? "설치하기" : "확인하기"}</small>
      </span>
    </button>
  );
}
