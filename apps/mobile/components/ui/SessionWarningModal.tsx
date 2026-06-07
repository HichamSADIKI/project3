/**
 * Popup d'avertissement affiché à chaque ouverture de session.
 * Rappelle les règles de sécurité, confidentialité et audit avant utilisation.
 */
import { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";

export function SessionWarningModal() {
  const { t } = useTranslation();
  const { token, sessionWarningShown, acknowledgeSessionWarning, user } = useAuthStore();
  const visible = !!token && !sessionWarningShown;

  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(scale, {
          toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  const bullets: { icon: string; key: string }[] = [
    { icon: "🔒", key: "warn_security" },
    { icon: "📁", key: "warn_confidentiality" },
    { icon: "📝", key: "warn_audit" },
    { icon: "⏱", key: "warn_session" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={acknowledgeSessionWarning}
    >
      <Animated.View style={[s.backdrop, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <View style={s.iconWrap}>
            <Text style={s.iconTxt}>⚠</Text>
          </View>

          <Text style={s.title}>{t("warn_title")}</Text>
          {user?.full_name ? (
            <Text style={s.hello}>{t("warn_hello", { name: user.full_name })}</Text>
          ) : null}

          <Text style={s.intro}>{t("warn_intro")}</Text>

          <View style={s.bullets}>
            {bullets.map((b) => (
              <View key={b.key} style={s.bulletRow}>
                <Text style={s.bulletIcon}>{b.icon}</Text>
                <Text style={s.bulletTxt}>{t(b.key)}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={s.btn}
            onPress={acknowledgeSessionWarning}
            activeOpacity={0.85}
          >
            <Text style={s.btnTxt}>{t("warn_acknowledge")}</Text>
          </TouchableOpacity>

          <Text style={s.footer}>{t("warn_footer")}</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8,11,17,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#161B22",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(184,146,79,0.35)",
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(184,146,79,0.18)",
    borderWidth: 1, borderColor: "rgba(184,146,79,0.45)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  iconTxt: { fontSize: 28, color: "#B8924F" },
  title: {
    fontSize: 18, fontWeight: "700", color: "#E2E8F0",
    textAlign: "center", letterSpacing: 0.3,
  },
  hello: {
    marginTop: 6, fontSize: 13, color: "#B8924F",
    fontWeight: "600", textAlign: "center",
  },
  intro: {
    marginTop: 12, fontSize: 13, lineHeight: 19,
    color: "#94A3B8", textAlign: "center",
  },
  bullets: {
    width: "100%", marginTop: 18, gap: 10,
    paddingHorizontal: 4,
  },
  bulletRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(31,41,55,0.55)",
    borderWidth: 1, borderColor: "#2D3748",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  bulletIcon: { fontSize: 16, marginTop: 1 },
  bulletTxt: {
    flex: 1, fontSize: 13, lineHeight: 18,
    color: "#CBD5E1",
  },
  btn: {
    marginTop: 22,
    backgroundColor: "#B8924F",
    borderRadius: 10,
    height: 48,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: {
    color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.4,
  },
  footer: {
    marginTop: 14, fontSize: 10, color: "#475569",
    textAlign: "center", letterSpacing: 0.4,
  },
});
