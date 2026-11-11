import { Alert, BackHandler } from 'react-native';
/** Exit only after a positive OK selection. */
export function confirmExit(language: 'my' | 'en', beforeExit?: string): void {
  const my = language === 'my';
  Alert.alert(
    my ? 'အက်ပ်မှ ထွက်မလား?' : 'Exit Money Tracker?',
    beforeExit ?? (my ? 'Money Tracker မှ ထွက်ရန် သေချာပါသလား?' : 'Are you sure you want to exit Money Tracker?'),
    [
      { text: my ? 'မလုပ်တော့' : 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: () => BackHandler.exitApp() },
    ],
    { cancelable: true },
  );
}
