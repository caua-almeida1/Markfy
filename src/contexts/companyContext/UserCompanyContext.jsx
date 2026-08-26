import React, { createContext, useContext, useEffect, useState } from "react";
import {
    getDatabase,
    ref,
    get,
    onValue
} from "firebase/database";
import { getAuth } from "firebase/auth";

const UserCompanyContext = createContext();

export const UserCompanyProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    const [companyHandle, setCompanyHandle] = useState(null);

    const loadCompany = async (currentUser) => {
        const db = getDatabase();

        const snapshot = await get(ref(db, "companys"));

        if (!snapshot.exists()) {
            setCompany(null);
            setCompanyHandle(null);
            setMembers([]);
            return;
        }

        const companies = snapshot.val();

        let foundCompany = null;
        let foundHandle = null;

        Object.entries(companies).forEach(([handle, companyData]) => {
            if (companyData.members?.[currentUser.uid]) {
                foundCompany = companyData;
                foundHandle = handle;
            }
        });

        if (!foundCompany) {
            setCompany(null);
            setCompanyHandle(null);
            setMembers([]);
            return;
        }

        setCompany({
            handle: foundHandle,
            ...foundCompany
        });

        setCompanyHandle(foundHandle);
    };

    const refreshCompany = async () => {
        const auth = getAuth();

        if (!auth.currentUser) return;

        await loadCompany(auth.currentUser);
    };

    useEffect(() => {
        const auth = getAuth();

        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {

            if (!currentUser) {

                setUser(null);
                setCompany(null);
                setCompanyHandle(null);
                setMembers([]);

                setLoading(false);

                return;
            }

            setUser(currentUser);

            await loadCompany(currentUser);

            if (!company) {
                await new Promise(resolve => setTimeout(resolve, 500));
                await loadCompany(currentUser);
            }

            setLoading(false);
        });

        return () => unsubscribe();

    }, []);

    useEffect(() => {

        if (!user) return;

        const db = getDatabase();

        const companiesRef = ref(db, "companys");

        const unsubscribe = onValue(
            companiesRef,
            async () => {

                await loadCompany(user);

            }
        );

        return () => unsubscribe();

    }, [user]);

    useEffect(() => {

        if (!companyHandle) return;

        const db = getDatabase();

        const membersRef = ref(
            db,
            `companys/${companyHandle}/members`
        );

        const unsubscribe = onValue(
            membersRef,
            async (snapshot) => {

                setLoadingMembers(true);

                const membersData = snapshot.val() || {};

                const loadedMembers = await Promise.all(

                    Object.entries(membersData).map(async ([uid, member]) => {

                        const userSnapshot = await get(
                            ref(db, `users/${uid}`)
                        );

                        if (!userSnapshot.exists()) return null;

                        return {
                            uid,

                            ...userSnapshot.val(),

                            role: member.role,

                            roleLabel:
                                member.role === "master"
                                    ? "Administrador"
                                    : "Profissional"
                        };

                    })

                );

                setMembers(
                    loadedMembers.filter(Boolean)
                );

                setLoadingMembers(false);

            }
        );

        return () => unsubscribe();

    }, [companyHandle]);

    return (
        <UserCompanyContext.Provider
            value={{
                user,
                company,
                members,
                loading,
                loadingMembers,
                refreshCompany
            }}
        >
            {children}
        </UserCompanyContext.Provider>
    );
};

export const useUserCompany = () => useContext(UserCompanyContext);
