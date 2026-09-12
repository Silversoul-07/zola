"use client"

import { InteractionPreferences } from "@/app/components/layout/settings/appearance/interaction-preferences"
import { LayoutSettings } from "@/app/components/layout/settings/appearance/layout-settings"
import { ThemeSelection } from "@/app/components/layout/settings/appearance/theme-selection"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AppearanceSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ThemeSelection />
        <LayoutSettings />
        <InteractionPreferences />
      </CardContent>
    </Card>
  )
}
