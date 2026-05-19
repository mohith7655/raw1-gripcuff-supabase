// Web-only implementation — uses the Google Places JavaScript SDK (no CORS issues).
// IMPORTANT: Your API key must have the Places API enabled in Google Cloud Console.
// For production, restrict the key to HTTP referrers for your domain.

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

// Module-level flag so it survives re-renders and StrictMode double-invocations
let googleMapsLoaded = false;

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export type LocationValue = {
    address: string;
    placeName?: string; // first segment of autocomplete description — the actual place/business name
    lat: number;
    lng: number;
};

type Suggestion = {
    description: string;
    place_id: string;
    place: any;
};

type Props = {
    value: LocationValue | null;
    onChange: (loc: LocationValue) => void;
};

export function LocationPickerField({ value, onChange }: Props) {
    const [inputText, setInputText] = useState(value?.address ?? '');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(
        () => googleMapsLoaded || !!(typeof window !== 'undefined' && window.google?.maps?.places)
    );
    const [apiError, setApiError] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep input text in sync with value prop (handles async Firestore load + external clear)
    useEffect(() => {
        // Prefer placeName for display so the gym/place name is visible, not the full formatted address
        setInputText(value ? (value.placeName ?? value.address) : '');
    }, [value]);

    // Load Google Maps + poll until window.google.maps.places is available
    useEffect(() => {
        console.log('LocationPickerField — API KEY:', API_KEY ? `${API_KEY.slice(0, 8)}...` : 'UNDEFINED');

        if (!API_KEY) {
            console.error('LocationPickerField: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not defined');
            return;
        }

        // Already ready — nothing to do
        if (window.google?.maps?.places) {
            googleMapsLoaded = true;
            setGoogleReady(true);
            return;
        }

        // Poll every 200ms — more reliable than onload in Expo web / Webpack HMR
        const pollInterval = setInterval(() => {
            if (window.google?.maps?.places) {
                console.log('LocationPickerField: Google Maps places library ready');
                googleMapsLoaded = true;
                setGoogleReady(true);
                clearInterval(pollInterval);
            }
        }, 200);

        // Inject the script tag if not already present
        if (!document.getElementById('google-maps-script')) {
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            // No `loading=async` — that defers places library init and causes the ready check to lag
            script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.addEventListener('error', (e) =>
                console.error('LocationPickerField: Google Maps script failed to load', e)
            );
            document.head.appendChild(script);
        }

        // Give up after 15 seconds
        const timeout = setTimeout(() => {
            clearInterval(pollInterval);
            console.error('LocationPickerField: Google Maps failed to load within 15 seconds');
        }, 15000);

        return () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
        };
    }, []);

    const fetchSuggestions = useCallback(async (text: string) => {
        console.log('fetchSuggestions — googleReady:', googleReady, 'window.google.maps.places:', !!window.google?.maps?.places);

        if (!googleReady || !window.google?.maps?.places) {
            console.warn('LocationPickerField: Google Maps not ready yet');
            return;
        }
        if (text.length < 2) {
            setSuggestions([]);
            return;
        }
        setApiError(null);
        try {
            const AutocompleteSuggestion = window.google.maps.places.AutocompleteSuggestion;
            const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: text,
                language: 'en',
            });
            setSuggestions(
                (result.suggestions ?? []).map((s: any) => ({
                    description: s.placePrediction.text.toString(),
                    place_id: s.placePrediction.placeId,
                    place: s.placePrediction.toPlace(),
                }))
            );
        } catch (e: any) {
            const msg: string = e?.message ?? String(e);
            if (msg.includes('ApiTargetBlockedMapError') || msg.includes('REQUEST_DENIED')) {
                setApiError('Location search unavailable. Check API key configuration.');
            } else {
                setApiError('Could not fetch suggestions. Please try again.');
            }
            setSuggestions([]);
            console.error('LocationPickerField: fetchAutocompleteSuggestions error', e);
        }
    }, [googleReady]);

    const handleChangeText = (text: string) => {
        setInputText(text);
        setApiError(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
    };

    const handleSelect = async (s: Suggestion) => {
        setInputText(s.description);
        setIsFocused(false);
        setSuggestions([]);
        setApiError(null);
        setLoading(true);
        try {
            await s.place.fetchFields({ fields: ['location', 'formattedAddress'] });
            const placeName = s.description.split(',')[0].trim();
            onChange({
                address: s.place.formattedAddress ?? s.description,
                placeName,
                lat: s.place.location.lat(),
                lng: s.place.location.lng(),
            });
        } catch (e) {
            console.warn('LocationPickerField: fetchFields error', e);
            const placeName = s.description.split(',')[0].trim();
            onChange({ address: s.description, placeName, lat: 0, lng: 0 });
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
                    placeholder="Search your location"
                    placeholderTextColor="#6B7280"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                />
                {loading && <ActivityIndicator size="small" color="#F97316" style={{ marginLeft: 6 }} />}
            </View>

            {showDropdown && (
                <View style={styles.dropdown}>
                    {!googleReady ? (
                        <Text style={styles.statusText}>Loading Google Maps…</Text>
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
                        <Text style={styles.statusText}>No results found</Text>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        marginBottom: 16,
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
        backgroundColor: '#1F2937',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#374151',
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
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#374151',
        zIndex: 9999,
        elevation: 9999,
        maxHeight: 200,
        overflow: 'scroll',
    } as any,
    row: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
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
