import { useCallback, useEffect, useState } from "react";

import {
    getAuth,
    onAuthStateChanged
} from "firebase/auth";

import {
    get,
    getDatabase,
    ref
} from "firebase/database";

import { getClientId } from "../../../../utils/clientID";


/* =========================================================
   DADOS DO PERFIL

   Junta, num lugar só, as três perguntas que a tela de
   perfil precisa responder:

     - quem é a pessoa (conta + registro em users/{uid});
     - ela administra alguma empresa;
     - quantos agendamentos ela tem nesta empresa.

   Fica fora do componente porque a tela é só apresentação —
   e porque a ordem importa: a resposta de "está logado?"
   precisa vir do listener do Firebase, não de uma leitura
   solta de `auth.currentUser`, que é null enquanto a sessão
   está sendo restaurada do disco.
   ========================================================= */


/* Cargos que dão acesso à central da empresa. */
const CARGOS_COM_PAINEL = [
    "master",
    "administrator",
    "professional"
];


const ROTULO_DO_CARGO = {
    master: "Dono",
    administrator: "Administrador",
    professional: "Profissional"
};


export const useProfileData = (companyHandle) => {

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);

    /* null enquanto carrega; depois, ou os dados da empresa
       que a pessoa administra, ou false para "nenhuma". */
    const [membership, setMembership] = useState(null);

    const [bookings, setBookings] = useState(null);

    const [loading, setLoading] = useState(true);


    /* ---------------------------------------------------
       CONTA
    --------------------------------------------------- */

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(
            getAuth(),
            async (currentUser) => {

                setUser(currentUser || null);

                if (!currentUser) {

                    setProfile(null);
                    setMembership(false);
                    setBookings(null);
                    setLoading(false);

                    return;

                }

                try {

                    const snapshot = await get(
                        ref(
                            getDatabase(),
                            `users/${currentUser.uid}`
                        )
                    );

                    setProfile(snapshot.val() || {});

                } catch (error) {

                    console.warn(
                        "Não foi possível ler o perfil:",
                        error
                    );

                    setProfile({});

                }

                setLoading(false);

            }
        );

        return unsubscribe;

    }, []);


    /* ---------------------------------------------------
       EMPRESA QUE A PESSOA ADMINISTRA

       O handle fica em users/{uid}/companyHandle, mas ele
       pode estar velho — alguém removido da equipe continua
       com o campo preenchido. Por isso o cargo é sempre
       relido de companys/{handle}/members/{uid}: é essa
       leitura, e não o campo do usuário, que decide se o
       botão da central aparece.
    --------------------------------------------------- */

    useEffect(() => {

        let cancelled = false;

        const carregar = async () => {

            if (!user) {
                return;
            }

            const db = getDatabase();

            try {

                const handleSnapshot = await get(
                    ref(
                        db,
                        `users/${user.uid}/companyHandle`
                    )
                );

                if (!handleSnapshot.exists()) {

                    if (!cancelled) setMembership(false);

                    return;

                }

                const handle = handleSnapshot.val();

                const [memberSnapshot, companySnapshot] =
                    await Promise.all([

                        get(
                            ref(
                                db,
                                `companys/${handle}/members/${user.uid}`
                            )
                        ),

                        get(
                            ref(
                                db,
                                `companys/${handle}/name`
                            )
                        )

                    ]);

                if (cancelled) return;

                const member = memberSnapshot.val();

                if (
                    !member ||
                    !CARGOS_COM_PAINEL.includes(member.role)
                ) {

                    setMembership(false);

                    return;

                }

                setMembership({

                    handle,

                    role: member.role,

                    roleLabel:
                        ROTULO_DO_CARGO[member.role] ||
                        "Membro",

                    companyName:
                        companySnapshot.val() ||
                        handle

                });

            } catch (error) {

                console.warn(
                    "Não foi possível ler a empresa do usuário:",
                    error
                );

                if (!cancelled) setMembership(false);

            }

        };

        carregar();

        return () => {
            cancelled = true;
        };

    }, [user]);


    /* ---------------------------------------------------
       AGENDAMENTOS NESTA EMPRESA

       Os agendamentos ficam em companys/{handle}/schedules
       e são identificados por `clientId` (o aparelho) ou por
       `userId`, quando a pessoa estava logada ao agendar.
       As duas chaves entram na conta, senão quem agendou
       antes de criar a conta não veria o próprio histórico.
    --------------------------------------------------- */

    const carregarAgendamentos = useCallback(async () => {

        if (!companyHandle) {
            setBookings(null);
            return;
        }

        try {

            const snapshot = await get(
                ref(
                    getDatabase(),
                    `companys/${companyHandle}/schedules`
                )
            );

            const todos =
                Object.entries(snapshot.val() || {})
                    .map(([id, value]) => ({ id, ...value }));

            const clientId = getClientId();

            const meus = todos.filter(
                (item) =>
                    (user?.uid && item.userId === user.uid) ||
                    (clientId && item.clientId === clientId)
            );

            setBookings({

                total: meus.length,

                ativos: meus.filter(
                    (item) => item.status === "pending"
                ).length,

                concluidos: meus.filter(
                    (item) => item.status === "completed"
                ).length

            });

        } catch (error) {

            console.warn(
                "Não foi possível contar os agendamentos:",
                error
            );

            setBookings(null);

        }

    }, [companyHandle, user]);


    useEffect(() => {

        carregarAgendamentos();

    }, [carregarAgendamentos]);


    return {
        user,
        profile,
        membership,
        bookings,
        loading
    };

};


export default useProfileData;
