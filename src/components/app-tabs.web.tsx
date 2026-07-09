import {
    TabList,
    TabListProps,
    Tabs,
    TabSlot,
    TabTrigger,
    TabTriggerSlotProps,
} from "expo-router/ui";
import { AndroidSymbol, SymbolView } from "expo-symbols";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { MaxContentWidth, NarrowBreakpoint, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useIsNarrowScreen } from "@/hooks/use-is-narrow-screen";

export default function AppTabs() {
    return (
        <Tabs>
            <TabSlot style={{ height: "100%" }} />
            <TabList asChild>
                <CustomTabList>
                    <TabTrigger name="dashboard" href="/" asChild>
                        <TabButton icon="home">Dashboard</TabButton>
                    </TabTrigger>
                    <TabTrigger
                        name="transactions"
                        href="/transactions"
                        asChild>
                        <TabButton icon="receipt_long">Transactions</TabButton>
                    </TabTrigger>
                    <TabTrigger name="budgets" href="/budgets" asChild>
                        <TabButton icon="savings">Budgets</TabButton>
                    </TabTrigger>
                    <TabTrigger name="msi" href="/msi" asChild>
                        <TabButton icon="payments">MSI</TabButton>
                    </TabTrigger>
                    <TabTrigger
                        name="notifications"
                        href="/notifications"
                        asChild>
                        <TabButton icon="notifications">Alerts</TabButton>
                    </TabTrigger>
                    <TabTrigger name="settings" href="/settings" asChild>
                        <TabButton icon="settings">Settings</TabButton>
                    </TabTrigger>
                </CustomTabList>
            </TabList>
        </Tabs>
    );
}

type TabButtonProps = TabTriggerSlotProps & {
    icon: AndroidSymbol;
};

export function TabButton({
    children,
    icon,
    isFocused,
    ...props
}: TabButtonProps) {
    const theme = useTheme();
    const isNarrow = useIsNarrowScreen();

    return (
        <Pressable
            {...props}
            style={({ pressed }) => [
                isNarrow && styles.tabButtonPressableNarrow,
                pressed && styles.pressed,
            ]}>
            <ThemedView
                type={isFocused ? "backgroundSelected" : "backgroundElement"}
                style={[
                    styles.tabButtonView,
                    isNarrow && styles.tabButtonViewNarrow,
                ]}>
                <SymbolView
                    name={{ web: icon }}
                    size={isNarrow ? 22 : 16}
                    tintColor={isFocused ? theme.text : theme.textSecondary}
                />
                <ThemedText
                    type="small"
                    themeColor={isFocused ? "text" : "textSecondary"}
                    numberOfLines={1}
                    style={isNarrow && styles.tabButtonLabelNarrow}>
                    {children}
                </ThemedText>
            </ThemedView>
        </Pressable>
    );
}

export function CustomTabList(props: TabListProps) {
    const isNarrow = useIsNarrowScreen();
    const insets = useSafeAreaInsets();

    return (
        <View
            {...props}
            style={[
                styles.tabListContainer,
                isNarrow ? styles.tabListContainerNarrow : styles.tabListContainerWide,
            ]}>
            <ThemedView
                type="backgroundElement"
                style={[
                    styles.innerContainer,
                    isNarrow && [
                        styles.innerContainerNarrow,
                        { paddingBottom: Spacing.two + insets.bottom },
                    ],
                ]}>
                {!isNarrow && (
                    <ThemedText type="smallBold" style={styles.brandText}>
                        Budgiette
                    </ThemedText>
                )}

                {isNarrow ? (
                    <View style={styles.tabRowNarrow}>{props.children}</View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.tabScroll}
                        contentContainerStyle={styles.tabScrollContent}>
                        {props.children}
                    </ScrollView>
                )}
            </ThemedView>
        </View>
    );
}

const styles = StyleSheet.create({
    tabListContainer: {
        position: "absolute",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
    },
    tabListContainerWide: {
        top: 0,
        padding: Spacing.three,
    },
    tabListContainerNarrow: {
        bottom: 0,
    },
    innerContainer: {
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.five,
        borderRadius: Spacing.five,
        flexDirection: "row",
        alignItems: "center",
        flexGrow: 1,
        gap: Spacing.two,
        maxWidth: MaxContentWidth,
    },
    innerContainerNarrow: {
        paddingHorizontal: Spacing.one,
        paddingTop: Spacing.one,
        borderRadius: 0,
        gap: 0,
        maxWidth: "100%",
    },
    brandText: {
        marginRight: "auto",
    },
    tabScroll: {
        flexShrink: 1,
    },
    tabScrollContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.one,
    },
    tabRowNarrow: {
        flexDirection: "row",
        alignItems: "stretch",
        flexGrow: 1,
        width: "100%",
    },
    pressed: {
        opacity: 0.7,
    },
    tabButtonView: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.one,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.three,
    },
    tabButtonViewNarrow: {
        flexDirection: "column",
        justifyContent: "center",
        gap: Spacing.half,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.one,
        borderRadius: Spacing.two,
    },
    tabButtonPressableNarrow: {
        flex: 1,
    },
    tabButtonLabelNarrow: {
        fontSize: 11,
        lineHeight: 14,
    },
});
