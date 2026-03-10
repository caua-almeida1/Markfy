import React, { createContext, useContext, useEffect, useState } from "react";
import { getDatabase, ref, get } from "firebase/database";
import { getAuth } from "firebase/auth";

const UserCompanyContext = createContext();

export const UserCompanyProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (!currentUser) {
                setUser(null);
                setCompany(null);
                setLoading(false);
                return;
            }

            setUser(currentUser);

            try {
                const db = getDatabase();
                const companysRef = ref(db, "companys");
                const snapshot = await get(companysRef);

                if (snapshot.exists()) {
                    const companies = snapshot.val();
                    let foundCompany = null;
                    let foundHandle = null;

                    // 🔍 Busca o usuário entre os membros de todas as empresas
                    Object.entries(companies).forEach(([handle, companyData]) => {
                        if (companyData.members && companyData.members[currentUser.uid]) {
                            foundCompany = companyData;
                            foundHandle = handle;
                        }
                    });

                    if (foundCompany) {
                        setCompany({
                            handle: foundHandle,
                            ...foundCompany,
                        });
                    } else {
                        setCompany(null);
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar empresa do usuário:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <UserCompanyContext.Provider value={{ user, company, loading }}>
            {children}
        </UserCompanyContext.Provider>
    );
};

export const useUserCompany = () => useContext(UserCompanyContext);
