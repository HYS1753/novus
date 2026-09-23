import React, { useState } from "react";
import {
  GlassSheet,
  GlassListRow,
  GlassSlider,
  GlassToggle,
  GlassBadge,
  GlassDivider,
  GlassButton,
  useMaterialIntensity,
  describeMaterialIntensity,
  SettingsIcon,
  MoonIcon,
  BatteryIcon,
} from "@/shared";

export interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({ isOpen, onClose }) => {
  const { intensity, setIntensity } = useMaterialIntensity();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [autoStart, setAutoStart] = useState(true);
  const [batteryOptimization, setBatteryOptimization] = useState(true);

  const handleThemeChange = (nextDark: boolean) => {
    setIsDark(nextDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextDark);
    }
  };

  return (
    <GlassSheet
      isOpen={isOpen}
      onClose={onClose}
      title="대시보드 설정"
      description="Novus 스마트 디스플레이 환경을 기기 사양에 맞게 조정합니다."
      side="right"
      width={420}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <GlassButton variant="primary" size="md" onClick={onClose}>
            완료
          </GlassButton>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* 디스플레이 & 머티리얼 */}
        <section>
          <GlassDivider label="비주얼 & 머티리얼" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <GlassSlider
              value={intensity}
              onChange={setIntensity}
              min={0}
              max={100}
              step={5}
              label={`머티리얼 강도 (${describeMaterialIntensity(intensity)})`}
              formatValue={(val) => `${val}%`}
            />
            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "0 0 8px 0",
              }}
            >
              * 0%는 저사양 완벽 불투명 모드로 GPU 연산 부담이 전혀 없습니다.
            </p>

            <GlassListRow
              label="다크 모드"
              description="야간 및 저조도 환경을 위한 고대비 다크 테마"
              leading={<MoonIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={isDark}
                  onChange={handleThemeChange}
                  aria-label="다크 모드 전환"
                />
              }
            />
          </div>
        </section>

        {/* 시스템 & 전원 최적화 */}
        <section>
          <GlassDivider label="시스템 & 전원" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <GlassListRow
              label="부팅 시 자동 시작"
              description="PC 부팅 시 Novus 홈 화면을 첫 화면으로 실행"
              leading={<SettingsIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={autoStart}
                  onChange={setAutoStart}
                  aria-label="부팅 시 자동 시작"
                />
              }
            />

            <GlassListRow
              label="배터리 스웰링 방지 모드"
              description="상시 거치 시 배터리 수명 보호 및 발열 억제"
              leading={<BatteryIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={batteryOptimization}
                  onChange={setBatteryOptimization}
                  aria-label="배터리 수명 보호 모드"
                />
              }
            />
          </div>
        </section>

        {/* 기기 프로필 & 상태 */}
        <section>
          <GlassDivider label="디바이스 프로필" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <GlassListRow
              label="타깃 하드웨어"
              description="Surface Pro 4 (Intel Core m3, 4GB RAM)"
              trailing={
                <GlassBadge variant="primary" size="sm">
                  최적화됨
                </GlassBadge>
              }
            />
            <GlassListRow
              label="메모리 프로필"
              description="초경량 모드 (RAM ~30MB 목표)"
              trailing={
                <GlassBadge variant="neutral" size="sm">
                  Ultra-Light
                </GlassBadge>
              }
            />
            <GlassListRow
              label="코어 엔진"
              description="Tauri v2 + Edge WebView2"
              trailing={
                <GlassBadge variant="neutral" size="sm">
                  v2.0.0
                </GlassBadge>
              }
            />
          </div>
        </section>
      </div>
    </GlassSheet>
  );
};

GlassSheet.displayName = "SettingsSheet";
