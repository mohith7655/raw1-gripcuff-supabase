import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { MapPin } from 'lucide-react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const GOOGLE_PLACES_WEB_PROXY_URL =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_WEB_PROXY_URL ??
    'https://corsproxy.io/?https://maps.googleapis.com/maps/api';

export type CityValue = {
    city: string;
    state: string;
    country: string;
    displayText: string;
};

type Props = {
    value: CityValue | null;
    onChange: (val: CityValue) => void;
};

function parseCity(data: any, details: any): CityValue {
    const components: any[] = details?.address_components ?? [];
    const get = (type: string) =>
        components.find((c: any) => c.types?.includes(type))?.long_name ?? '';
    const city =
        get('locality') ||
        get('administrative_area_level_3') ||
        get('sublocality_level_1') ||
        data.description.split(',')[0].trim();
    const state = get('administrative_area_level_1');
    const country = get('country');
    return {
        city,
        state,
        country,
        displayText: [city, state, country].filter(Boolean).join(', ') || data.description,
    };
}

export function CityPickerField({ value, onChange }: Props) {
    return (
        <View style={styles.wrapper}>
            <GooglePlacesAutocomplete
                placeholder="Search your city"
                fetchDetails
                minLength={2}
                debounce={300}
                query={{ key: API_KEY, language: 'en', types: '(cities)' }}
                requestUrl={{
                    useOnPlatform: 'web',
                    url: GOOGLE_PLACES_WEB_PROXY_URL,
                }}
                onPress={(data, details) => onChange(parseCity(data, details))}
                styles={{
                    container: styles.container,
                    textInputContainer: styles.inputContainer,
                    textInput: styles.input,
                    listView: styles.listView,
                    row: styles.row,
                    description: styles.description,
                    separator: styles.separator,
                }}
                textInputProps={{
                    placeholderTextColor: '#6B7280',
                    autoCorrect: false,
                    autoCapitalize: 'none',
                }}
                enablePoweredByContainer={false}
                keepResultsAfterBlur
            />
            {!!value && (
                <View style={styles.selected}>
                    <MapPin color="#F97316" size={14} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.selectedTitle} numberOfLines={1}>{value.city}</Text>
                        <Text style={styles.selectedSub} numberOfLines={1}>
                            {[value.state, value.country].filter(Boolean).join(', ')}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 8,
        zIndex: 9999,
    } as any,
    container: {
        flex: 0,
        zIndex: 9999,
    } as any,
    inputContainer: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 0,
    },
    input: {
        height: 44,
        backgroundColor: '#131f2e',
        borderRadius: 10,
        color: '#fff',
        fontSize: 15,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#1e2d40',
        outlineStyle: 'none',
    } as any,
    listView: {
        backgroundColor: '#1a2740',
        borderRadius: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#1e2d40',
        zIndex: 9999,
        boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
    } as any,
    row: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    description: {
        color: '#fff',
        fontSize: 14,
    },
    separator: {
        height: 1,
        backgroundColor: '#1e2d40',
    },
    selected: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: 'rgba(249,115,22,0.11)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.24)',
    },
    selectedTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    selectedSub: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 1,
    },
});
