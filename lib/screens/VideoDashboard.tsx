import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Library, Dumbbell, User } from 'lucide-react-native';
import { HomeScreen } from './HomeScreen';
import { LibraryScreen } from './LibraryScreen';
import { WorkoutsScreen } from './WorkoutsScreen';
import { ProfileScreen } from './ProfileScreen';

const Tab = createBottomTabNavigator();

export const VideoDashboard = () => {
    return (
        <Tab.Navigator
            initialRouteName="Library"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#F8F8FC',
                    borderTopColor: 'rgba(0,0,0,0.2)',
                    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
                    elevation: 8,
                },
                tabBarActiveTintColor: '#F25912',
                tabBarInactiveTintColor: '#7A7C90',
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                tabBarIcon: ({ color, size }) => {
                    if (route.name === 'Home') return <Home color={color} size={size} />;
                    if (route.name === 'Library') return <Library color={color} size={size} />;
                    if (route.name === 'Workouts') return <Dumbbell color={color} size={size} />;
                    if (route.name === 'Profile') return <User color={color} size={size} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'Exercise Library' }} />
            <Tab.Screen name="Workouts" component={WorkoutsScreen} options={{ tabBarLabel: 'Workouts' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
        </Tab.Navigator>
    );
};
