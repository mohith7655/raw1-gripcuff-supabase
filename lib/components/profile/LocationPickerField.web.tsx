import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { MapPin } from 'lucide-react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const GOOGLE_PLACES_WEB_PROXY_URL =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_WEB_PROXY_URL ??
    'https://corsproxy.io/?https://maps.googleapis.com/maps/api';

export type LocationValue = {
    address: string;
    placeName?: string;
    placeId?: string;
    lat: number;
    lng: number;
};

type Props = {
    value: LocationValue | null;
    onChange: (loc: LocationValue) => void;
};

export function LocationPickerField({ value, onChange }: Props) {
    return (
        <View style={styles.wrapper}>
            <GooglePlacesAutocomplete
                placeholder="Search your location"
                fetchDetails
                minLength={2}
                debounce={300}
                query={{ key: API_KEY, language: 'en' }}
                requestUrl={{
                    useOnPlatform: 'web',
                    url: GOOGLE_PLACES_WEB_PROXY_URL,
                }}
                onPress={(data, details) => {
                    const description = data.description || '';
                    const placeName = details?.name || description.split(',')[0]?.trim();
                    onChange({
                        address: details?.formatted_address || description,
                        placeName,
                        placeId: data.place_id,
                        lat: details?.geometry?.location?.lat ?? 0,
                        lng: details?.geometry?.location?.lng ?? 0,
                    });
                }}
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
            {!!value?.address && (
                <View style={styles.selected}>
                    <MapPin color="#F97316" size={14} />
                    <Text style={styles.selectedText} numberOfLines={2}>
                        {value.placeName || value.address}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 16,
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
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingHorizontal: 14,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
        gap: 7,
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: 'rgba(249,115,22,0.11)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.24)',
    },
    selectedText: {
        flex: 1,
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
    },
});
