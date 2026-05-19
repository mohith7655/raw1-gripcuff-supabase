import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { MapPin } from 'lucide-react-native';

declare global {
    interface Window { google: any; }
}

let googleMapsLoaded = false;

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export type CityValue = {
    city: string;
    state: string;
    country: string;
    displayText: string;
};

type Suggestion = {
    description: string;
    place_id: string;
    place: any;
};

type Props = {
    value: CityValue | null;
    onChange: (val: CityValue) => void;
};

export function CityPickerField({ value, onChange }: Props) {
    const [inputText, setInputText] = useState(value?.displayText ?? '');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(
        () => googleMapsLoaded || !!(typeof window !== 'undefined' && window.google?.maps?.places)
    );
    const [apiError, setApiError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setInputText(value?.displayText ?? '');
    }, [value]);

    useEffect(() => {
        if (!API_KEY) return;
        if (window.google?.maps?.places) {
            googleMapsLoaded = true;
            setGoogleReady(true);
            return;
        }
        const pollInterval = setInterval(() => {
            if (window.google?.maps?.places) {
                googleMapsLoaded = true;
                setGoogleReady(true);
                clearInterval(pollInterval);
            }
        }, 200);
        if (!document.getElementById('google-maps-script')) {
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
        const timeout = setTimeout(() => clearInterval(pollInterval), 15000);
        return () => { clearInterval(pollInterval); clearTimeout(timeout); };
    }, []);

    const fetchSuggestions = useCallback(async (text: string) => {
        if (!googleReady || !window.google?.maps?.places) return;
        if (text.length < 2) { setSuggestions([]); return; }
        setApiError(null);
        try {
            const AutocompleteSuggestion = window.google.maps.places.AutocompleteSuggestion;
            const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: text,
                language: 'en',
                includedPrimaryTypes: ['locality', 'administrative_area_level_3'],
            });
            setSuggestions(
                (result.suggestions ?? []).map((s: any) => ({
                    description: s.placePrediction.text.toString(),
                    place_id: s.placePrediction.placeId,
                    place: s.placePrediction.toPlace(),
                }))
            );
        } catch (e: any) {
            setApiError('Could not fetch suggestions. Please try again.');
            setSuggestions([]);
        }
    }, [googleReady]);

    const handleChangeText = (text: string) => {
        setInputText(text);
        setApiError(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
    };

    const handleSelect = async (s: Suggestion) => {
        setInputText(s.description.split(',')[0].trim());
        setIsFocused(false);
        setSuggestions([]);
        setApiError(null);
        setLoading(true);
        try {
            await s.place.fetchFields({ fields: ['addressComponents'] });
            const components: any[] = s.place.addressComponents ?? [];
            const get = (type: string) =>
                components.find((c: any) => c.types?.includes(type))?.longText ?? '';
            const city =
                get('locality') ||
                get('administrative_area_level_3') ||
                get('sublocality_level_1') ||
                s.description.split(',')[0].trim();
            const state = get('administrative_area_level_1');
            const country = get('country');
            const displayText = [city, state, country].filter(Boolean).join(', ');
            onChange({ city, state, country, displayText });
        } catch {
            const parts = s.description.split(',').map((p: string) => p.trim());
            onChange({
                city: parts[0] ?? '',
                state: parts[1] ?? '',
                country: parts[parts.length - 1] ?? '',
                displayText: s.description,
            });
        } finally {
            setLoading(false);
        }
    };

    const showDropdown = isFocused && inputText.length >= 2;

    return (
        <View style={styles.wrapper}>
            {showDropdown && (
                <TouchableOpacity
                    style={styles.backdrop}
                    onPress={() => setIsFocused(false)}
                    activeOpacity={1}
                />
            )}
            <View style={[styles.fieldInput, isFocused && styles.fieldInputFocused]}>
                <MapPin color={value ? '#F97316' : '#6B7280'} size={16} />
                <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={handleChangeText}
                    placeholder="Search your city"
                    placeholderTextColor="#4B5563"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                />
                {loading && <ActivityIndicator size="small" color="#F97316" style={{ marginLeft: 6 }} />}
            </View>
            {value && !isFocused && (
                <Text style={styles.autoFilled}>
                    {[value.state, value.country].filter(Boolean).join(', ')}
                </Text>
            )}
            {showDropdown && (
                <View style={styles.dropdown}>
                    {!googleReady ? (
                        <Text style={styles.statusText}>Loading…</Text>
                    ) : apiError ? (
                        <Text style={styles.errorText}>{apiError}</Text>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((s, i) => (
                            <TouchableOpacity
                                key={s.place_id}
                                style={[styles.row, i < suggestions.length - 1 && styles.rowBorder]}
                                onPress={() => handleSelect(s)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.rowText} numberOfLines={2}>{s.description}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.statusText}>No results</Text>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        marginBottom: 8,
        zIndex: 9999,
    } as any,
    backdrop: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9998,
    } as any,
    fieldInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#131f2e',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#1e2d40',
        gap: 8,
        zIndex: 9999,
    },
    fieldInputFocused: {
        borderColor: '#F97316',
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        outlineStyle: 'none',
    } as any,
    autoFilled: {
        color: '#6B7280',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#1a2740',
        borderRadius: 10,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#1e2d40',
        zIndex: 9999,
        elevation: 9999,
        maxHeight: 220,
        overflow: 'scroll',
    } as any,
    row: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#1e2d40',
    },
    rowText: {
        color: '#fff',
        fontSize: 14,
    },
    statusText: {
        color: '#9CA3AF',
        fontSize: 13,
        padding: 12,
    },
    errorText: {
        color: '#F97316',
        fontSize: 13,
        padding: 12,
    },
});
