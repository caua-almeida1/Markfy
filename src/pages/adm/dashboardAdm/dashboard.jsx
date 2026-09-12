import React, { useState, useEffect } from "react";
import "./DashboardAdm.css";

import { Icon } from "@iconify/react";

import {
    getAuth,
    signOut
} from "firebase/auth";

import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
    listAll,
} from "firebase/storage";

import {
    getDatabase,
    ref,
    onValue,
    get,
    set,
    push,
    update,
    remove,
} from "firebase/database";

import {
    motion,
    AnimatePresence
} from "framer-motion";

import emailjs from "@emailjs/browser";

import { useNavigate } from "react-router-dom";

import MaleEmoji1 from "../../../img/MEMOJIS PACK/males/emoji (1).svg";
import MaleEmoji2 from "../../../img/MEMOJIS PACK/males/emoji (2).svg";
import MaleEmoji3 from "../../../img/MEMOJIS PACK/males/emoji (3).svg";
import MaleEmoji4 from "../../../img/MEMOJIS PACK/males/emoji (4).svg";
import MaleEmoji5 from "../../../img/MEMOJIS PACK/males/emoji (5).svg";

import placeholder from "../../../img/product-details/not-professional.png";

import { OrderDetailsModal } from "../ordersAdm/orders";

import Toast from "../../../components/toast/Toast";

import {
    useUserCompany
} from "../../../contexts/companyContext/UserCompanyContext";


const Dashboard = ({
    activeTab,
    setActiveTab
}) => {

    /* =====================================================
       STATES
    ===================================================== */
    const [
        companyLogo,
        setCompanyLogo
    ] = useState(null);

    const [
        currentUserMember,
        setCurrentUserMember
    ] = useState(null);

    const [
        isAdminModalOpen,
        setIsAdminModalOpen
    ] = useState(false);

    const [
        isUserMenuOpen,
        setIsUserMenuOpen
    ] = useState(false);

    const [
        isLogoutModalOpen,
        setIsLogoutModalOpen
    ] = useState(false);

    const [
        isMembersModalOpen,
        setIsMembersModalOpen
    ] = useState(false);

    const [
        isRemoveMemberModalOpen,
        setIsRemoveMemberModalOpen
    ] = useState(false);

    const [
        removingMember,
        setRemovingMember
    ] = useState(false);

    const [
        selectedMember,
        setSelectedMember
    ] = useState(null);

    const [
        memberRole,
        setMemberRole
    ] = useState("");

    const [
        savingMemberRole,
        setSavingMemberRole
    ] = useState(false);

    const [
        isAdminModalVisible,
        setIsAdminModalVisible
    ] = useState(false);

    const [
        adminRegisterMode,
        setAdminRegisterMode
    ] = useState("manual");

    const [
        memberPhotos,
        setMemberPhotos
    ] = useState({});

    const [
        productPhotos,
        setProductPhotos
    ] = useState({});

    const [
        showBalance,
        setShowBalance
    ] = useState(false);

    const [
        transitioning,
        setTransitioning
    ] = useState(false);

    const [
        userName,
        setUserName
    ] = useState("");

    const [
        saldoEstimado,
        setSaldoEstimado
    ] = useState("R$ 0,00");

    const [
        orders,
        setOrders
    ] = useState([]);

    const [
        selectedOrder,
        setSelectedOrder
    ] = useState(null);

    const [
        inviteName,
        setInviteName
    ] = useState("");

    const [
        inviteEmail,
        setInviteEmail
    ] = useState("");

    const [
        inviteRole,
        setInviteRole
    ] = useState("administrator");

    const [
        sendingInvite,
        setSendingInvite
    ] = useState(false);

    const [
        toast,
        setToast
    ] = useState({
        show: false,
        type: "success",
        title: "",
        message: ""
    });

    const [
        isPageMenuOpen,
        setIsPageMenuOpen
    ] = useState(false);

    /* =====================================================
       CONTEXT
    ===================================================== */

    const navigate = useNavigate();

    const {
        members,
        company
    } = useUserCompany();


    const handleLogout = async () => {

        try {

            localStorage.removeItem("authUser");

            await signOut(
                getAuth()
            );

            navigate("/Login");

        } catch (error) {

            console.error(
                "Erro ao sair da conta:",
                error
            );

        }

    };

    /* =====================================================
       EMAIL
    ===================================================== */

    const SERVICE_ID = "service_2l02vyh";

    const TEMPLATE_ID = "template_qc4x8co";

    const PUBLIC_KEY = "QlWjNn5vihbWi9uLf";


    /* =====================================================
       TOAST
    ===================================================== */

    const showToast = (
        type,
        title,
        message
    ) => {

        setToast({
            show: true,
            type,
            title,
            message
        });

    };


    /* =====================================================
       ENVIAR CONVITE
    ===================================================== */

    const sendInviteEmail = async (
        invitedName,
        invitedEmail,
        companyName,
        inviterName,
        role,
        inviteLink
    ) => {

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
                invited_name: invitedName,

                invited_email: invitedEmail,

                inviter_name: inviterName,

                company_name: companyName,

                role:
                    role === "administrator"
                        ? "Administrador"
                        : "Profissional",

                invite_link: inviteLink
            },
            PUBLIC_KEY
        );

    };

    /* =====================================================
   CARREGAR LOGO DA EMPRESA
===================================================== */

    useEffect(() => {

        if (!company?.handle) {

            setCompanyLogo(null);

            return;

        }

        const storage = getStorage();

        const loadCompanyLogo = async () => {

            try {

                const logoRef = storageRef(
                    storage,
                    `companys/${company.handle}/logo.png`
                );

                const logoUrl = await getDownloadURL(
                    logoRef
                );

                setCompanyLogo(
                    logoUrl
                );

            } catch (error) {

                /*
                 * Caso a empresa ainda não tenha
                 * uma logo cadastrada.
                 */

                if (
                    error.code !==
                    "storage/object-not-found"
                ) {

                    console.error(
                        "Erro ao carregar logo da empresa:",
                        error
                    );

                }

                setCompanyLogo(null);

            }

        };

        loadCompanyLogo();

    }, [company?.handle]);

    /* =====================================================
   MEMBRO LOGADO
===================================================== */

    useEffect(() => {

        const auth = getAuth();

        const currentUser = auth.currentUser;

        if (!currentUser || !members?.length) {

            setCurrentUserMember(null);

            return;

        }

        const loggedMember = members.find(
            member =>
                member?.uid === currentUser.uid
        );

        setCurrentUserMember(
            loggedMember || null
        );

    }, [members]);

    /* =====================================================
       CARREGAR FOTOS DOS MEMBROS
    ===================================================== */

    useEffect(() => {

        if (
            !members ||
            members.length === 0
        ) {

            setMemberPhotos({});

            return;

        }

        const storage = getStorage();


        const loadMemberPhotos = async () => {

            const photos = {};


            await Promise.all(

                members.map(
                    async (member) => {

                        if (!member?.uid) {
                            return;
                        }

                        try {

                            const profileImageRef =
                                storageRef(
                                    storage,
                                    `users/${member.uid}/profileImg`
                                );

                            const photoUrl =
                                await getDownloadURL(
                                    profileImageRef
                                );

                            photos[
                                member.uid
                            ] = photoUrl;

                        } catch (error) {

                            if (
                                error.code !==
                                "storage/object-not-found"
                            ) {

                                console.error(
                                    `Erro ao carregar foto do usuário ${member.uid}:`,
                                    error
                                );

                            }

                        }

                    }
                )

            );


            setMemberPhotos(
                photos
            );

        };


        loadMemberPhotos();

    }, [members]);

    const openRemoveMemberConfirmation = () => {

        if (!selectedMember) return;

        if (
            selectedMember.uid ===
            getAuth().currentUser?.uid
        ) {

            showToast(
                "error",
                "Ação não permitida",
                "Você não pode remover sua própria conta da empresa."
            );

            return;

        }

        if (
            currentUserMember?.role !== "master"
        ) {

            showToast(
                "error",
                "Acesso negado",
                "Somente o administrador principal pode remover membros."
            );

            return;

        }

        setIsRemoveMemberModalOpen(true);

    };

    const handleRemoveMember = async () => {

        if (
            !selectedMember?.uid ||
            !company?.handle
        ) {
            return;
        }

        setRemovingMember(true);

        try {

            const db = getDatabase();

            const memberRef = ref(
                db,
                `companys/${company.handle}/members/${selectedMember.uid}`
            );

            await remove(memberRef);

            showToast(
                "success",
                "Membro removido",
                `${selectedMember.name || "O membro"} foi removido da empresa.`
            );

            setIsRemoveMemberModalOpen(false);

            setSelectedMember(null);

            /*
             * O onValue() do contexto vai atualizar
             * automaticamente a lista de membros.
             */

        } catch (error) {

            console.error(
                "Erro ao remover membro:",
                error
            );

            showToast(
                "error",
                "Erro ao remover",
                "Não foi possível remover este membro."
            );

        } finally {

            setRemovingMember(false);

        }

    };

    /* =====================================================
   CARREGAR PRIMEIRA FOTO DOS PRODUTOS DOS PEDIDOS
===================================================== */

    /* =====================================================
   CARREGAR PRIMEIRA FOTO DOS PRODUTOS
===================================================== */

    useEffect(() => {

        if (!orders || orders.length === 0) {

            setProductPhotos({});

            return;

        }

        const storage = getStorage();


        /*
         * Procura recursivamente a primeira imagem
         * dentro de uma pasta do Storage.
         *
         * Não importa o nome da imagem.
         */
        const findFirstImage = async (folderRef) => {

            try {

                const result =
                    await listAll(folderRef);


                /*
                 * Primeiro procura arquivos diretamente
                 * dentro dessa pasta.
                 */

                for (
                    const item
                    of result.items
                ) {

                    const name =
                        item.name.toLowerCase();


                    const isImage =
                        name.endsWith(".jpg") ||
                        name.endsWith(".jpeg") ||
                        name.endsWith(".png") ||
                        name.endsWith(".webp") ||
                        name.endsWith(".gif") ||
                        name.endsWith(".avif");


                    if (!isImage) {
                        continue;
                    }


                    try {

                        const url =
                            await getDownloadURL(
                                item
                            );

                        return url;

                    } catch (error) {

                        console.error(
                            "Erro ao obter URL da imagem:",
                            item.fullPath,
                            error
                        );

                    }

                }


                /*
                 * Caso não exista uma imagem diretamente
                 * nessa pasta, procura dentro das subpastas.
                 */

                for (
                    const subFolder
                    of result.prefixes
                ) {

                    const image =
                        await findFirstImage(
                            subFolder
                        );


                    if (image) {
                        return image;
                    }

                }


                return null;

            } catch (error) {

                console.error(
                    "Erro ao listar pasta do Storage:",
                    folderRef.fullPath,
                    error
                );

                return null;

            }

        };


        const loadProductPhotos =
            async () => {

                const photos = {};


                /*
                 * Evita buscar duas vezes
                 * o mesmo produto.
                 */

                const processed =
                    new Set();


                await Promise.all(

                    orders.map(
                        async order => {

                            if (
                                !order?.productId
                            ) {

                                console.warn(
                                    "Pedido sem productId:",
                                    order
                                );

                                return;

                            }


                            /*
                             * O handle vem do pedido.
                             */

                            const companyHandle =
                                order.companyHandle ||
                                company?.handle;


                            if (
                                !companyHandle
                            ) {

                                console.warn(
                                    "Pedido sem companyHandle:",
                                    order
                                );

                                return;

                            }


                            const key =
                                `${companyHandle}_${order.productId}`;


                            if (
                                processed.has(key)
                            ) {

                                return;

                            }


                            processed.add(key);


                            /*
                             * CAMINHO EXATO DO STORAGE
                             */

                            const path =
                                `companys/${companyHandle}/products/${order.productId}`;


                            console.log(
                                "--------------------------------"
                            );

                            console.log(
                                "BUSCANDO FOTO DO PRODUTO"
                            );

                            console.log(
                                "Company:",
                                companyHandle
                            );

                            console.log(
                                "Product ID:",
                                order.productId
                            );

                            console.log(
                                "Storage path:",
                                path
                            );


                            try {

                                const productFolderRef =
                                    storageRef(
                                        storage,
                                        path
                                    );


                                const imageUrl =
                                    await findFirstImage(
                                        productFolderRef
                                    );


                                if (
                                    imageUrl
                                ) {

                                    console.log(
                                        "FOTO ENCONTRADA:",
                                        imageUrl
                                    );


                                    photos[key] =
                                        imageUrl;

                                } else {

                                    console.warn(
                                        "NENHUMA FOTO ENCONTRADA PARA:",
                                        path
                                    );

                                }

                            } catch (error) {

                                console.error(
                                    "ERRO AO BUSCAR FOTO:",
                                    path,
                                    error
                                );

                            }

                        }
                    )

                );


                console.log(
                    "FOTOS DOS PRODUTOS:",
                    photos
                );


                setProductPhotos(
                    photos
                );

            };


        loadProductPhotos();

    }, [orders, company?.handle]);

    /* =====================================================
       EMAILJS
    ===================================================== */

    useEffect(() => {

        emailjs.init(
            PUBLIC_KEY
        );

    }, []);


    /* =====================================================
       SALDO
    ===================================================== */

    const toggleVisibility = () => {

        setTransitioning(true);

        setTimeout(() => {

            setShowBalance(
                prev => !prev
            );

            setTransitioning(false);

        }, 400);

    };


    /* =====================================================
       SAUDAÇÃO
    ===================================================== */

    const getGreeting = () => {

        const currentHour =
            new Date().getHours();

        if (
            currentHour < 12
        ) {

            return "Bom dia";

        }

        if (
            currentHour < 18
        ) {

            return "Boa tarde";

        }

        return "Boa noite";

    };


    /* =====================================================
       MODAL
    ===================================================== */

    const openAdminModal = () => {

        setIsAdminModalVisible(
            true
        );

        requestAnimationFrame(
            () => {
                setIsAdminModalOpen(
                    true
                );
            }
        );

    };


    const closeAdminModal = () => {

        setIsAdminModalOpen(
            false
        );

        setTimeout(() => {

            setIsAdminModalVisible(
                false
            );

        }, 300);

    };


    /* =====================================================
       BLOQUEAR SCROLL MODAL
    ===================================================== */

    useEffect(() => {

        if (
            isAdminModalVisible
        ) {

            document.body.style.overflow =
                "hidden";

        } else {

            document.body.style.overflow =
                "";

        }

        return () => {

            document.body.style.overflow =
                "";

        };

    }, [
        isAdminModalVisible
    ]);


    /* =====================================================
       DADOS PRINCIPAIS
    ===================================================== */

    useEffect(() => {

        const auth =
            getAuth();

        const user =
            auth.currentUser;


        if (!user) {
            return;
        }


        const db =
            getDatabase();


        /* ===============================
           USUÁRIO
        =============================== */

        const userRef =
            ref(
                db,
                `users/${user.uid}`
            );


        get(userRef)
            .then(snapshot => {

                if (
                    snapshot.exists()
                ) {

                    const data =
                        snapshot.val();

                    setUserName(
                        data.name ||
                        "Usuário"
                    );

                } else {

                    setUserName(
                        "Usuário"
                    );

                }

            })
            .catch(error => {

                console.error(
                    "Erro ao buscar nome:",
                    error
                );

                setUserName(
                    "Usuário"
                );

            });


        /* ===============================
           EMPRESAS
        =============================== */

        const companiesRef =
            ref(
                db,
                "companys"
            );


        const unsubscribe =
            onValue(
                companiesRef,
                (snapshot) => {

                    if (
                        !snapshot.exists()
                    ) {

                        setSaldoEstimado(
                            "R$ 0,00"
                        );

                        setOrders([]);

                        return;

                    }


                    const companiesData =
                        snapshot.val();


                    let totalValue = 0;

                    const professionalOrders =
                        [];


                    for (
                        const companyKey
                        of Object.keys(
                            companiesData
                        )
                    ) {

                        const currentCompany =
                            companiesData[
                            companyKey
                            ];


                        const schedules =
                            currentCompany.schedules ||
                            {};

                        const products =
                            currentCompany.products ||
                            {};


                        Object.keys(
                            schedules
                        ).forEach(
                            scheduleId => {

                                const schedule =
                                    schedules[
                                    scheduleId
                                    ];


                                /* ===============================
                                   PENDENTES
                                =============================== */

                                if (
                                    schedule.professionalId ===
                                    user.uid &&
                                    schedule.status ===
                                    "pending"
                                ) {

                                    const product =
                                        products[
                                        schedule.productId
                                        ] || {};


                                    const productImage =
                                        Array.isArray(
                                            product.images
                                        )
                                            ? product.images[0]
                                            : product.images ||
                                            placeholder;


                                    let endTimeDisplay =
                                        schedule.hour ||
                                        "—";


                                    if (
                                        schedule.hour &&
                                        product?.duration
                                    ) {

                                        const durationMinutes =
                                            Number(
                                                product.duration
                                            );


                                        if (
                                            !isNaN(
                                                durationMinutes
                                            )
                                        ) {

                                            const [
                                                startHour,
                                                startMin
                                            ] =
                                                schedule.hour
                                                    .split(":")
                                                    .map(
                                                        Number
                                                    );


                                            const totalMinutes =
                                                startHour *
                                                60 +
                                                startMin +
                                                durationMinutes;


                                            const endHour =
                                                Math.floor(
                                                    totalMinutes /
                                                    60
                                                ) % 24;


                                            const endMin =
                                                totalMinutes %
                                                60;


                                            const formattedEnd =
                                                `${endHour
                                                    .toString()
                                                    .padStart(
                                                        2,
                                                        "0"
                                                    )}:${endMin
                                                        .toString()
                                                        .padStart(
                                                            2,
                                                            "0"
                                                        )}`;


                                            endTimeDisplay =
                                                `${schedule.hour} - ${formattedEnd}`;

                                        }

                                    }


                                    professionalOrders.push({

                                        id:
                                            scheduleId,

                                        productId:
                                            schedule.productId,

                                        companyHandle:
                                            companyKey,

                                        productName:
                                            product.name ||
                                            "Serviço",

                                        productValue:
                                            schedule.productPrice ||
                                            "—",

                                        productImage,

                                        day:
                                            schedule.day ||
                                            "—",

                                        hour:
                                            schedule.hour ||
                                            "—",

                                        fullHour:
                                            endTimeDisplay,

                                        clientName:
                                            schedule.userName ||
                                            "Cliente",

                                        status:
                                            schedule.status ||
                                            "pending",

                                        companyName:
                                            currentCompany.name ||
                                            ""

                                    });

                                }


                                /* ===============================
                                   COMPLETADOS
                                =============================== */

                                if (
                                    schedule.professionalId ===
                                    user.uid &&
                                    schedule.status ===
                                    "completed" &&
                                    schedule.productPrice
                                ) {

                                    const numericPrice =
                                        parseFloat(

                                            schedule.productPrice
                                                .replace(
                                                    "R$",
                                                    ""
                                                )
                                                .replace(
                                                    ".",
                                                    ""
                                                )
                                                .replace(
                                                    ",",
                                                    "."
                                                )
                                                .trim()

                                        );


                                    totalValue +=
                                        numericPrice;

                                }

                            }
                        );

                    }


                    /* ===============================
                       ORDENAR
                    =============================== */

                    const sortedOrders =
                        professionalOrders.sort(
                            (a, b) => {

                                try {

                                    const [
                                        dayA,
                                        monthA,
                                        yearA
                                    ] =
                                        a.day
                                            .split("/")
                                            .map(
                                                Number
                                            );


                                    const [
                                        hourA,
                                        minuteA
                                    ] =
                                        a.hour
                                            .split(":")
                                            .map(
                                                Number
                                            );


                                    const dateA =
                                        new Date(
                                            yearA,
                                            monthA - 1,
                                            dayA,
                                            hourA,
                                            minuteA
                                        );


                                    const [
                                        dayB,
                                        monthB,
                                        yearB
                                    ] =
                                        b.day
                                            .split("/")
                                            .map(
                                                Number
                                            );


                                    const [
                                        hourB,
                                        minuteB
                                    ] =
                                        b.hour
                                            .split(":")
                                            .map(
                                                Number
                                            );


                                    const dateB =
                                        new Date(
                                            yearB,
                                            monthB - 1,
                                            dayB,
                                            hourB,
                                            minuteB
                                        );


                                    return (
                                        dateA -
                                        dateB
                                    );

                                } catch {

                                    return 0;

                                }

                            }
                        );


                    setOrders(
                        sortedOrders
                    );


                    setSaldoEstimado(

                        totalValue.toLocaleString(
                            "pt-BR",
                            {
                                style: "currency",
                                currency: "BRL"
                            }
                        )

                    );

                },

                error => {

                    console.error(
                        "Erro ao ouvir empresas:",
                        error
                    );

                    setSaldoEstimado(
                        "R$ 0,00"
                    );

                    setOrders([]);

                }
            );


        return () =>
            unsubscribe();

    }, []);


    /* =====================================================
       FINALIZAR PEDIDO
    ===================================================== */

    const handleCompleteOrder =
        async order => {

            const db =
                getDatabase();

            const companyRef =
                ref(
                    db,
                    "companys"
                );

            const snapshot =
                await get(
                    companyRef
                );


            if (
                snapshot.exists()
            ) {

                const companies =
                    snapshot.val();


                for (
                    const companyKey
                    in companies
                ) {

                    const schedules =
                        companies[
                            companyKey
                        ].schedules ||
                        {};


                    if (
                        schedules[
                        order.id
                        ]
                    ) {

                        await update(

                            ref(
                                db,
                                `companys/${companyKey}/schedules/${order.id}`
                            ),

                            {
                                status:
                                    "completed"
                            }

                        );


                        setSelectedOrder(
                            null
                        );

                        return;

                    }

                }

            }

        };


    /* =====================================================
       CANCELAR PEDIDO
    ===================================================== */

    const handleCancelOrder =
        async order => {

            const db =
                getDatabase();

            const companyRef =
                ref(
                    db,
                    "companys"
                );

            const snapshot =
                await get(
                    companyRef
                );


            if (
                snapshot.exists()
            ) {

                const companies =
                    snapshot.val();


                for (
                    const companyKey
                    in companies
                ) {

                    const schedules =
                        companies[
                            companyKey
                        ].schedules ||
                        {};


                    if (
                        schedules[
                        order.id
                        ]
                    ) {

                        await update(

                            ref(
                                db,
                                `companys/${companyKey}/schedules/${order.id}`
                            ),

                            {
                                status:
                                    "cancelados"
                            }

                        );


                        setSelectedOrder(
                            null
                        );

                        return;

                    }

                }

            }

        };


    /* =====================================================
       CONVITE
    ===================================================== */

    const handleSendInvite =
        async e => {

            e.preventDefault();


            if (
                !inviteName.trim()
            ) {

                alert(
                    "Informe o nome."
                );

                return;

            }


            if (
                !inviteEmail.trim()
            ) {

                alert(
                    "Informe o e-mail."
                );

                return;

            }


            setSendingInvite(
                true
            );


            try {

                const db =
                    getDatabase();

                const auth =
                    getAuth();

                const uid =
                    auth.currentUser.uid;


                const companiesSnapshot =
                    await get(
                        ref(
                            db,
                            "companys"
                        )
                    );


                let companyName =
                    "";

                let companyHandle =
                    "";


                if (
                    companiesSnapshot.exists()
                ) {

                    const companies =
                        companiesSnapshot.val();


                    for (
                        const companyKey
                        in companies
                    ) {

                        const currentMembers =
                            companies[
                                companyKey
                            ].members ||
                            {};


                        if (
                            currentMembers[
                            uid
                            ]
                        ) {

                            companyName =
                                companies[
                                    companyKey
                                ].name;

                            companyHandle =
                                companyKey;

                            break;

                        }

                    }

                }


                const inviteRef =
                    push(
                        ref(
                            db,
                            "invites"
                        )
                    );


                const inviteId =
                    inviteRef.key;


                const inviteLink =
                    `${window.location.origin}/invite/${inviteId}`;


                await set(
                    inviteRef,
                    {

                        invitedName:
                            inviteName,

                        invitedEmail:
                            inviteEmail
                                .toLowerCase()
                                .trim(),

                        inviterUid:
                            uid,

                        inviterName:
                            userName,

                        companyHandle,

                        companyName,

                        role:
                            inviteRole,

                        status:
                            "pending",

                        createdAt:
                            Date.now(),

                        expiresAt:
                            Date.now() +
                            1000 *
                            60 *
                            60 *
                            24 *
                            15,

                        acceptedAt:
                            null,

                        acceptedBy:
                            null

                    }
                );


                await sendInviteEmail(

                    inviteName,

                    inviteEmail,

                    companyName,

                    userName,

                    inviteRole,

                    inviteLink

                );


                showToast(
                    "success",
                    "Convite enviado",
                    "O convite foi enviado para o e-mail informado."
                );


                setInviteName("");
                setInviteEmail("");
                setInviteRole(
                    "administrator"
                );

                closeAdminModal();

            } catch (err) {

                console.error(
                    "EMAILJS ERROR:",
                    err
                );


                showToast(
                    "error",
                    "Erro ao enviar",
                    "Não foi possível enviar o convite. Tente novamente."
                );

            } finally {

                setSendingInvite(
                    false
                );

            }

        };


    /* =====================================================
       HELPERS
    ===================================================== */


    /* =====================================================
   PÁGINA DA EMPRESA
===================================================== */

    const getCompanyPageUrl = () => {

        if (!company?.handle) {
            return "";
        }

        return `${window.location.origin}/central-user/${company.handle}`;

    };


    const handleAccessCompanyPage = () => {

        const url = getCompanyPageUrl();

        if (!url) {
            return;
        }

        setIsPageMenuOpen(false);

        navigate(
            `/central-user/${company.handle}`
        );

    };


    const handleCopyCompanyPageLink = async () => {

        const url = getCompanyPageUrl();

        if (!url) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                url
            );

            setIsPageMenuOpen(false);

            showToast(
                "success",
                "Link copiado",
                "O link da página da empresa foi copiado."
            );

        } catch (error) {

            console.error(
                "Erro ao copiar link:",
                error
            );

            showToast(
                "error",
                "Não foi possível copiar",
                "Copie o link manualmente e tente novamente."
            );

        }

    };

    const truncate = (
        text,
        max = 16
    ) => {

        if (!text) {
            return "—";
        }

        return text.length > max
            ? `${text.slice(0, max)}...`
            : text;

    };

    const getCurrentUserRole = () => {

        if (!currentUserMember) {
            return "Profissional";
        }

        return currentUserMember.role === "master"
            ? "Administrador"
            : "Profissional";

    };


    const getMemberInitial =
        member => {

            const name =
                member?.name?.trim() ||
                "Usuário";


            return name
                .charAt(0)
                .toUpperCase();

        };


    /* =====================================================
       DATA
    ===================================================== */

    const pendingOrders =
        orders.length;


    const teamCount =
        members?.length || 0;


    /* =====================================================
       RENDER
    ===================================================== */

    /* =====================================================
   GERENCIAMENTO DE MEMBROS
===================================================== */

    const openMembersModal = () => {

        setIsMembersModalOpen(true);

    };


    const closeMembersModal = () => {

        setIsMembersModalOpen(false);

    };


    const openMemberDetails = (member) => {

        setSelectedMember(member);

        setMemberRole(
            member?.role === "master"
                ? "master"
                : member?.role === "administrator"
                    ? "administrator"
                    : "professional"
        );

    };


    const closeMemberDetails = () => {

        setSelectedMember(null);

        setMemberRole("");

    };


    /* =====================================================
       ALTERAR ROLE
    ===================================================== */

    const handleChangeMemberRole = async () => {

        if (
            !selectedMember?.uid ||
            !company?.handle
        ) {
            return;
        }

        const auth = getAuth();

        const loggedUser = auth.currentUser;

        if (!loggedUser) {
            return;
        }


        /*
         * Somente o master pode alterar funções.
         */

        if (
            currentUserMember?.role !== "master"
        ) {

            showToast(
                "error",
                "Acesso negado",
                "Somente o administrador principal pode alterar funções."
            );

            return;

        }


        /*
         * Impede alterar a própria função.
         */

        if (
            selectedMember.uid === loggedUser.uid
        ) {

            showToast(
                "error",
                "Ação não permitida",
                "Você não pode alterar sua própria função."
            );

            return;

        }


        setSavingMemberRole(true);


        try {

            const db =
                getDatabase();


            const memberRef =
                ref(
                    db,
                    `companys/${company.handle}/members/${selectedMember.uid}`
                );


            await update(
                memberRef,
                {
                    role: memberRole
                }
            );


            /*
             * Atualiza imediatamente o membro
             * aberto no modal.
             */

            setSelectedMember(
                prev =>
                    prev
                        ? {
                            ...prev,
                            role: memberRole
                        }
                        : prev
            );


            showToast(
                "success",
                "Função atualizada",
                "A função do membro foi atualizada com sucesso."
            );


        } catch (error) {

            console.error(
                "Erro ao alterar função do membro:",
                error
            );


            showToast(
                "error",
                "Erro ao atualizar",
                "Não foi possível alterar a função deste membro."
            );


        } finally {

            setSavingMemberRole(false);

        }

    };

    return (

        <div className="dashboard-page">

            {/* =================================================
                MAIN
            ================================================= */}
            <header className="dashboard-topbar">

                {/* =========================
        COMPANY
    ========================= */}

                <div className="dashboard-topbar-company">

                    <div className="dashboard-company-mark">

                        {companyLogo ? (

                            <img
                                src={companyLogo}
                                alt={`Logo de ${company?.name || "empresa"}`}
                            />

                        ) : (

                            <span>
                                {company?.name
                                    ?.charAt(0)
                                    ?.toUpperCase() || "M"}
                            </span>

                        )}

                    </div>

                    <div className="dashboard-company-info">

                        <strong>
                            {company?.name || "Minha empresa"}
                        </strong>

                        <span>
                            Painel administrativo
                        </span>

                    </div>

                </div>


                {/* =========================
        RIGHT
    ========================= */}

                <div className="dashboard-topbar-right">

                    {/* VER PÁGINA */}

                    <div className="dashboard-page-menu-wrapper">

                        <button
                            className={`dashboard-topbar-page-button ${isPageMenuOpen
                                ? "dashboard-topbar-page-button--open"
                                : ""
                                }`}
                            type="button"
                            onClick={() => {

                                setIsUserMenuOpen(false);

                                setIsPageMenuOpen(
                                    prev => !prev
                                );

                            }}
                        >

                            <span>
                                Ver página
                            </span>

                            <Icon
                                icon="lucide:chevron-down"
                                className="dashboard-topbar-page-chevron"
                            />

                        </button>


                        <AnimatePresence>

                            {isPageMenuOpen && (

                                <motion.div
                                    className="dashboard-page-menu"

                                    initial={{
                                        opacity: 0,
                                        y: -8,
                                        scale: .97
                                    }}

                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1
                                    }}

                                    exit={{
                                        opacity: 0,
                                        y: -8,
                                        scale: .97
                                    }}

                                    transition={{
                                        duration: .18,
                                        ease: [0.22, 1, 0.36, 1]
                                    }}
                                >

                                    {/* ACESSAR PÁGINA */}

                                    <button
                                        type="button"
                                        className="dashboard-page-menu-item"
                                        onClick={
                                            handleAccessCompanyPage
                                        }
                                    >

                                        <div className="dashboard-page-menu-icon">

                                            <Icon
                                                icon="lucide:external-link"
                                            />

                                        </div>

                                        <div className="dashboard-page-menu-content">

                                            <strong>
                                                Acessar página
                                            </strong>

                                            <span>
                                                Veja como seus clientes visualizam
                                            </span>

                                        </div>

                                        <Icon
                                            icon="lucide:chevron-right"
                                            className="dashboard-page-menu-arrow"
                                        />

                                    </button>


                                    <div className="dashboard-page-menu-divider" />


                                    {/* COPIAR LINK */}

                                    <button
                                        type="button"
                                        className="dashboard-page-menu-item"
                                        onClick={
                                            handleCopyCompanyPageLink
                                        }
                                    >

                                        <div className="dashboard-page-menu-icon">

                                            <Icon
                                                icon="lucide:copy"
                                            />

                                        </div>

                                        <div className="dashboard-page-menu-content">

                                            <strong>
                                                Copiar link
                                            </strong>

                                            <span>
                                                Compartilhe a página da empresa
                                            </span>

                                        </div>

                                    </button>

                                </motion.div>

                            )}

                        </AnimatePresence>

                    </div>


                    {/* DIVIDER */}

                    <div className="dashboard-topbar-divider" />


                    {/* USER */}

                    <div className="dashboard-user-wrapper">

                        <button
                            className={`dashboard-user ${isUserMenuOpen
                                ? "dashboard-user--open"
                                : ""
                                }`}
                            type="button"
                            onClick={() => {

                                setIsPageMenuOpen(false);

                                setIsUserMenuOpen(
                                    prev => !prev
                                );

                            }}
                        >

                            {/* FOTO */}

                            <div className="dashboard-user-avatar">

                                {currentUserMember &&
                                    memberPhotos[
                                    currentUserMember.uid
                                    ] ? (

                                    <img
                                        src={
                                            memberPhotos[
                                            currentUserMember.uid
                                            ]
                                        }
                                        alt={
                                            currentUserMember.name ||
                                            userName ||
                                            "Usuário"
                                        }
                                    />

                                ) : (

                                    <span>
                                        {(
                                            currentUserMember?.name ||
                                            userName ||
                                            "U"
                                        )
                                            ?.charAt(0)
                                            ?.toUpperCase()}
                                    </span>

                                )}

                            </div>


                            {/* INFORMAÇÕES */}

                            <div className="dashboard-user-info">

                                <strong>
                                    {
                                        currentUserMember?.name ||
                                        userName ||
                                        "Usuário"
                                    }
                                </strong>

                                <span>
                                    {getCurrentUserRole()}
                                </span>

                            </div>


                            {/* CHEVRON */}

                            <Icon
                                icon="lucide:chevron-down"
                                className={`dashboard-user-chevron ${isUserMenuOpen
                                    ? "dashboard-user-chevron--open"
                                    : ""
                                    }`}
                            />

                        </button>


                        {/* =================================================
        USER DROPDOWN
    ================================================= */}

                        <AnimatePresence>

                            {isUserMenuOpen && (

                                <motion.div
                                    className="dashboard-user-menu"

                                    initial={{
                                        opacity: 0,
                                        y: -8,
                                        scale: 0.97
                                    }}

                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1
                                    }}

                                    exit={{
                                        opacity: 0,
                                        y: -8,
                                        scale: 0.97
                                    }}

                                    transition={{
                                        duration: 0.18,
                                        ease: [0.22, 1, 0.36, 1]
                                    }}
                                >

                                    {/* VER PERFIL */}

                                    <button
                                        className="dashboard-user-menu-item"
                                        type="button"
                                        onClick={() => {

                                            setIsUserMenuOpen(false);

                                            setActiveTab(
                                                "perfil",
                                                {
                                                    initialScreen: "profile"
                                                }
                                            );

                                        }}
                                    >

                                        <div className="dashboard-user-menu-icon">

                                            <Icon
                                                icon="lucide:user-round"
                                            />

                                        </div>

                                        <div className="dashboard-user-menu-content">

                                            <strong>
                                                Ver perfil
                                            </strong>

                                            <span>
                                                Acesse seu perfil e configurações
                                            </span>

                                        </div>

                                        <Icon
                                            icon="lucide:chevron-right"
                                            className="dashboard-user-menu-arrow"
                                        />

                                    </button>


                                    {/* DIVIDER */}

                                    <div className="dashboard-user-menu-divider" />


                                    {/* SAIR */}

                                    <button
                                        className="
                        dashboard-user-menu-item
                        dashboard-user-menu-item--logout
                    "
                                        type="button"
                                        onClick={() => {

                                            setIsUserMenuOpen(false);

                                            setIsLogoutModalOpen(true);

                                        }}
                                    >

                                        <div className="dashboard-user-menu-icon">

                                            <Icon
                                                icon="lucide:log-out"
                                            />

                                        </div>

                                        <div className="dashboard-user-menu-content">

                                            <strong>
                                                Sair da conta
                                            </strong>

                                            <span>
                                                Encerrar sua sessão
                                            </span>

                                        </div>

                                    </button>

                                </motion.div>

                            )}

                        </AnimatePresence>

                    </div>

                </div>

            </header>
            <main className="dashboard-main">


                {/* =================================================
                    WELCOME
                ================================================= */}
                {/* =================================================
    DASHBOARD CONTEXT
================================================= */}

                {/* =================================================
    TOP BAR
================================================= */}



                <section className="dashboard-welcome">

                    <div>

                        <span>
                            {getGreeting()}
                        </span>

                        <h1>
                            {userName || "Usuário"}.
                        </h1>

                        <p>
                            Aqui está um resumo do que
                            está acontecendo na sua empresa.
                        </p>

                    </div>


                    <button
                        className="dashboard-new-action"
                        onClick={() =>
                            setActiveTab(
                                "produtos",
                                {
                                    openModal: true
                                }
                            )
                        }
                    >

                        <Icon
                            icon="lucide:plus"
                        />

                        Novo produto

                    </button>

                </section>


                {/* =================================================
                    METRICS
                ================================================= */}

                <section className="dashboard-metrics">


                    {/* SALDO */}

                    <article className="dashboard-metric-card">

                        <div className="dashboard-metric-header">

                            <span>
                                Receita estimada
                            </span>

                            <button
                                onClick={
                                    toggleVisibility
                                }
                            >

                                <Icon
                                    icon={
                                        showBalance
                                            ? "mdi:eye"
                                            : "mdi:eye-off"
                                    }
                                />

                            </button>

                        </div>


                        <div className="dashboard-metric-value">

                            <strong
                                className={
                                    transitioning
                                        ? "dashboard-value-hidden"
                                        : ""
                                }
                            >

                                {showBalance
                                    ? saldoEstimado
                                    : "••••••"}

                            </strong>

                        </div>


                        <div className="dashboard-metric-footer">

                            <span className="dashboard-positive">

                                <Icon
                                    icon="lucide:trending-up"
                                />

                                Este período

                            </span>

                            <span>
                                Serviços concluídos
                            </span>

                        </div>

                    </article>


                    {/* AGENDAMENTOS */}

                    <article className="dashboard-metric-card">

                        <div className="dashboard-metric-header">

                            <span>
                                Próximos agendamentos
                            </span>

                            <div className="dashboard-metric-icon">

                                <Icon
                                    icon="lucide:calendar-days"
                                />

                            </div>

                        </div>


                        <div className="dashboard-metric-value">

                            <strong>
                                {pendingOrders}
                            </strong>

                            <span>
                                agendamentos
                            </span>

                        </div>


                        <div className="dashboard-metric-footer">

                            <button
                                onClick={() =>
                                    setActiveTab("horarios")
                                }
                            >
                                Ver agenda
                            </button>

                        </div>

                    </article>


                    {/* EQUIPE */}

                    <article className="dashboard-metric-card">

                        <div className="dashboard-metric-header">

                            <span>
                                Equipe
                            </span>

                            <div className="dashboard-metric-icon">

                                <Icon
                                    icon="lucide:users"
                                />

                            </div>

                        </div>


                        <div className="dashboard-metric-value">

                            <strong>
                                {teamCount}
                            </strong>

                            <span>
                                {teamCount === 1
                                    ? "membro"
                                    : "membros"}
                            </span>

                        </div>


                        <div className="dashboard-metric-footer">

                            <button
                                onClick={openMembersModal}
                            >

                                <Icon
                                    icon="lucide:users"
                                />

                                Gerenciar membros

                            </button>

                        </div>

                    </article>


                </section>


                {/* =================================================
                    GRID PRINCIPAL
                ================================================= */}

                <section className="dashboard-workspace">


                    {/* =================================================
                        AGENDA / PEDIDOS
                    ================================================= */}

                    <div className="dashboard-panel dashboard-orders-panel">

                        <div className="dashboard-panel-header">

                            <div>

                                <span>
                                    OPERAÇÃO
                                </span>

                                <h2>
                                    Próximos atendimentos
                                </h2>

                            </div>

                            <button
                                onClick={() =>
                                    setActiveTab(
                                        "pedidos"
                                    )
                                }
                            >
                                Ver todos
                                <Icon
                                    icon="lucide:arrow-up-right"
                                />
                            </button>

                        </div>


                        <div className="dashboard-orders-list">

                            {orders.length > 0 ? (

                                orders
                                    .slice(0, 5)
                                    .map(order => (

                                        <button
                                            key={order.id}
                                            className="dashboard-order-row"
                                            onClick={() =>
                                                setSelectedOrder(
                                                    order
                                                )
                                            }
                                        >

                                            <div className="dashboard-order-client">

                                                <div className="dashboard-order-avatar">

                                                    {productPhotos[
                                                        `${order.companyHandle}_${order.productId}`
                                                    ] ? (

                                                        <img
                                                            src={
                                                                productPhotos[
                                                                `${order.companyHandle}_${order.productId}`
                                                                ]
                                                            }
                                                            alt={
                                                                order.productName ||
                                                                "Produto"
                                                            }
                                                        />

                                                    ) : (

                                                        <span>
                                                            {order.productName
                                                                ?.charAt(0)
                                                                ?.toUpperCase() || "P"}
                                                        </span>

                                                    )}

                                                </div>

                                                <div>

                                                    <strong>
                                                        {
                                                            order.clientName
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            order.productName
                                                        }
                                                    </span>

                                                </div>

                                            </div>


                                            <div className="dashboard-order-date">

                                                <strong>
                                                    {
                                                        order.hour
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        order.day
                                                    }
                                                </span>

                                            </div>


                                            <div className="dashboard-order-price">

                                                <strong>
                                                    {
                                                        order.productValue
                                                    }
                                                </strong>

                                                <span>
                                                    Pendente
                                                </span>

                                            </div>


                                            <Icon
                                                icon="lucide:chevron-right"
                                                className="dashboard-order-arrow"
                                            />

                                        </button>

                                    ))

                            ) : (

                                <div className="dashboard-empty-state">

                                    <div className="dashboard-empty-icon">

                                        <Icon
                                            icon="lucide:calendar-x"
                                        />

                                    </div>

                                    <div>

                                        <strong>
                                            Nenhum atendimento próximo
                                        </strong>

                                        <span>
                                            Quando houver novos
                                            agendamentos, eles aparecerão aqui.
                                        </span>

                                    </div>

                                </div>

                            )}

                        </div>

                    </div>


                    {/* =================================================
                        AÇÕES
                    ================================================= */}

                    <aside className="dashboard-panel dashboard-actions-panel">

                        <div className="dashboard-panel-header">

                            <div>

                                <span>
                                    ATALHOS
                                </span>

                                <h2>
                                    Ações rápidas
                                </h2>

                            </div>

                        </div>


                        <div className="dashboard-quick-actions">


                            <button
                                onClick={() =>
                                    setActiveTab(
                                        "produtos"
                                    )
                                }
                            >

                                <div className="dashboard-action-icon">

                                    <Icon
                                        icon="lucide:package-plus"
                                    />

                                </div>

                                <div>

                                    <strong>
                                        Novo produto
                                    </strong>

                                    <span>
                                        Adicione um serviço ou produto
                                    </span>

                                </div>

                                <Icon
                                    icon="lucide:arrow-up-right"
                                />

                            </button>


                            <button
                                onClick={
                                    openAdminModal
                                }
                            >

                                <div className="dashboard-action-icon">

                                    <Icon
                                        icon="lucide:user-plus"
                                    />

                                </div>

                                <div>

                                    <strong>
                                        Adicionar membro
                                    </strong>

                                    <span>
                                        Convide alguém para sua equipe
                                    </span>

                                </div>

                                <Icon
                                    icon="lucide:arrow-up-right"
                                />

                            </button>

                            <button
                                className="adm-perfil-row"
                                onClick={() =>
                                    setActiveTab("perfil", {
                                        initialScreen: "settings-company"
                                    })
                                }
                            >

                                <div className="dashboard-action-icon">

                                    <Icon
                                        icon="lucide:settings-2"
                                    />

                                </div>

                                <div>

                                    <strong>
                                        Configuração da empresa
                                    </strong>

                                    <span>
                                        Personalize informações e preferências
                                    </span>

                                </div>

                                <Icon
                                    icon="lucide:arrow-up-right"
                                />

                            </button>

                            <button
                                onClick={() => {

                                    if (
                                        !company?.handle
                                    ) {
                                        return;
                                    }

                                    navigate(
                                        `/central-user/${company.handle}`
                                    );

                                }}
                            >

                                <div className="dashboard-action-icon">

                                    <Icon
                                        icon="lucide:globe"
                                    />

                                </div>

                                <div>

                                    <strong>
                                        Minha página
                                    </strong>

                                    <span>
                                        Veja como seus clientes visualizam
                                    </span>

                                </div>

                                <Icon
                                    icon="lucide:arrow-up-right"
                                />

                            </button>


                        </div>

                    </aside>

                </section>


                {/* =================================================
                    EQUIPE
                ================================================= */}

                <section className="dashboard-panel dashboard-team-panel">

                    <div className="dashboard-panel-header">

                        <div>

                            <span>
                                EQUIPE
                            </span>

                            <h2>
                                Membros da empresa
                            </h2>

                        </div>


                        <button
                            onClick={
                                openAdminModal
                            }
                        >

                            <Icon
                                icon="lucide:user-plus"
                            />

                            Adicionar membro

                        </button>

                    </div>


                    <div className="dashboard-team-list">

                        {members &&
                            members.length > 0 ? (

                            members.map(
                                member => (

                                    <button
                                        key={member.uid}
                                        type="button"
                                        className="dashboard-team-member"
                                        onClick={() =>
                                            openMemberDetails(member)
                                        }
                                    >

                                        <div className="dashboard-team-avatar">

                                            {memberPhotos[
                                                member.uid
                                            ] ? (

                                                <img
                                                    src={
                                                        memberPhotos[
                                                        member.uid
                                                        ]
                                                    }
                                                    alt={
                                                        member.name ||
                                                        "Usuário"
                                                    }
                                                />

                                            ) : (

                                                <span>
                                                    {
                                                        getMemberInitial(
                                                            member
                                                        )
                                                    }
                                                </span>

                                            )}

                                        </div>


                                        <div className="dashboard-team-member-info">

                                            <strong>

                                                {member.name?.length > 24
                                                    ? `${member.name.slice(0, 24)}...`
                                                    : member.name}

                                            </strong>

                                            <span>
                                                {member.role === "master"
                                                    ? "Administrador principal"
                                                    : member.role === "administrator"
                                                        ? "Administrador"
                                                        : "Profissional"}
                                            </span>

                                        </div>


                                        <Icon
                                            icon="lucide:more-horizontal"
                                            className="dashboard-team-more"
                                        />

                                    </button>

                                )
                            )

                        ) : (

                            <div className="dashboard-team-empty">

                                <Icon
                                    icon="lucide:users"
                                />

                                <span>
                                    Nenhum membro cadastrado.
                                </span>

                            </div>

                        )}

                    </div>

                </section>


            </main>


            {/* =====================================================
                ORDER MODAL
            ===================================================== */}

            <AnimatePresence>

                {selectedOrder && (

                    <OrderDetailsModal

                        order={
                            selectedOrder
                        }

                        onClose={() =>
                            setSelectedOrder(
                                null
                            )
                        }

                        onComplete={
                            handleCompleteOrder
                        }

                        onCancel={
                            handleCancelOrder
                        }

                    />

                )}

            </AnimatePresence>

            {/* =====================================================
    MEMBERS MANAGEMENT MODAL
===================================================== */}

            <AnimatePresence>

                {isMembersModalOpen && (

                    <motion.div
                        className="dashboard-members-modal-overlay"

                        initial={{
                            opacity: 0
                        }}

                        animate={{
                            opacity: 1
                        }}

                        exit={{
                            opacity: 0
                        }}

                        transition={{
                            duration: 0.2
                        }}

                        onClick={closeMembersModal}
                    >

                        <motion.div
                            className="dashboard-members-modal"

                            initial={{
                                opacity: 0,
                                y: 20,
                                scale: 0.96
                            }}

                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1
                            }}

                            exit={{
                                opacity: 0,
                                y: 12,
                                scale: 0.97
                            }}

                            transition={{
                                duration: 0.24,
                                ease: [0.22, 1, 0.36, 1]
                            }}

                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >

                            {/* HEADER */}

                            <div className="dashboard-members-modal-header">

                                <div>

                                    <span>
                                        EQUIPE
                                    </span>

                                    <h2>
                                        Gerenciar membros
                                    </h2>

                                    <p>
                                        Gerencie as pessoas que fazem parte da sua empresa.
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    className="dashboard-members-modal-close"
                                    onClick={closeMembersModal}
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            {/* SUMMARY */}

                            <div className="dashboard-members-summary">

                                <div>

                                    <div className="dashboard-members-summary-icon">

                                        <Icon
                                            icon="lucide:users-round"
                                        />

                                    </div>

                                    <div>

                                        <strong>
                                            {teamCount}
                                        </strong>

                                        <span>
                                            {teamCount === 1
                                                ? "membro"
                                                : "membros"}
                                        </span>

                                    </div>

                                </div>


                                <button
                                    type="button"
                                    onClick={() => {

                                        closeMembersModal();

                                        openAdminModal();

                                    }}
                                >

                                    <Icon
                                        icon="lucide:user-plus"
                                    />

                                    Adicionar membro

                                </button>

                            </div>


                            {/* LIST */}

                            <div className="dashboard-members-modal-list">

                                {members?.length > 0 ? (

                                    members.map(member => (

                                        <div
                                            key={member.uid}
                                            className="dashboard-members-modal-item"
                                            onClick={() =>
                                                openMemberDetails(member)
                                            }
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {

                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {

                                                    openMemberDetails(member);

                                                }

                                            }}
                                        >

                                            <div className="dashboard-members-modal-avatar">

                                                {memberPhotos[member.uid] ? (

                                                    <img
                                                        src={
                                                            memberPhotos[
                                                            member.uid
                                                            ]
                                                        }
                                                        alt={
                                                            member.name ||
                                                            "Usuário"
                                                        }
                                                    />

                                                ) : (

                                                    <span>
                                                        {getMemberInitial(member)}
                                                    </span>

                                                )}

                                            </div>


                                            <div className="dashboard-members-modal-info">

                                                <strong>
                                                    {member.name || "Usuário"}
                                                </strong>

                                                <span>
                                                    {member.role === "master"
                                                        ? "Administrador principal"
                                                        : member.role === "administrator"
                                                            ? "Administrador"
                                                            : "Profissional"}
                                                </span>

                                            </div>


                                            <Icon
                                                icon="lucide:chevron-right"
                                                className="dashboard-members-modal-arrow"
                                            />

                                        </div>

                                    ))

                                ) : (

                                    <div className="dashboard-members-modal-empty">

                                        <Icon
                                            icon="lucide:users"
                                        />

                                        <strong>
                                            Nenhum membro encontrado
                                        </strong>

                                        <span>
                                            Adicione pessoas para começar a montar sua equipe.
                                        </span>

                                    </div>

                                )}

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>

            <AnimatePresence>

                {selectedMember && (

                    <motion.div
                        className="dashboard-member-details-overlay"

                        initial={{
                            opacity: 0
                        }}

                        animate={{
                            opacity: 1
                        }}

                        exit={{
                            opacity: 0
                        }}

                        transition={{
                            duration: 0.2
                        }}

                        onClick={closeMemberDetails}
                    >

                        <motion.div
                            className="dashboard-member-details-modal"

                            initial={{
                                opacity: 0,
                                y: 20,
                                scale: 0.95
                            }}

                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1
                            }}

                            exit={{
                                opacity: 0,
                                y: 12,
                                scale: 0.97
                            }}

                            transition={{
                                duration: 0.24,
                                ease: [0.22, 1, 0.36, 1]
                            }}

                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >

                            {/* HEADER */}

                            <div className="dashboard-member-details-header">

                                <button
                                    type="button"
                                    onClick={closeMemberDetails}
                                >

                                    <Icon
                                        icon="lucide:arrow-left"
                                    />

                                </button>


                                <span>
                                    MEMBRO
                                </span>


                                <button
                                    type="button"
                                    onClick={closeMemberDetails}
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            {/* PROFILE */}

                            <div className="dashboard-member-details-profile">

                                <div className="dashboard-member-details-avatar">

                                    {memberPhotos[
                                        selectedMember.uid
                                    ] ? (

                                        <img
                                            src={
                                                memberPhotos[
                                                selectedMember.uid
                                                ]
                                            }
                                            alt={
                                                selectedMember.name ||
                                                "Usuário"
                                            }
                                        />

                                    ) : (

                                        <span>
                                            {getMemberInitial(
                                                selectedMember
                                            )}
                                        </span>

                                    )}

                                </div>


                                <div>

                                    <h2>
                                        {selectedMember.name || "Usuário"}
                                    </h2>

                                    <span>

                                        {selectedMember.role === "master"
                                            ? "Administrador principal"
                                            : selectedMember.role === "administrator"
                                                ? "Administrador"
                                                : "Profissional"}

                                    </span>

                                </div>

                            </div>


                            {/* INFORMATION */}

                            <div className="dashboard-member-details-section">

                                <div className="dashboard-member-details-section-title">

                                    <Icon
                                        icon="lucide:user-round"
                                    />

                                    <span>
                                        Informações
                                    </span>

                                </div>


                                <div className="dashboard-member-details-info-grid">

                                    <div>

                                        <span>
                                            Nome
                                        </span>

                                        <strong>
                                            {selectedMember.name || "Não informado"}
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Identificador
                                        </span>

                                        <strong
                                            title={selectedMember.uid}
                                        >
                                            {truncate(
                                                selectedMember.uid,
                                                20
                                            )}
                                        </strong>

                                    </div>

                                </div>

                            </div>


                            {/* ROLE */}

                            <div className="dashboard-member-details-section">

                                <div className="dashboard-member-details-section-title">

                                    <Icon
                                        icon="lucide:shield-check"
                                    />

                                    <span>
                                        Função na empresa
                                    </span>

                                </div>


                                <div className="dashboard-member-role-control">

                                    <label>
                                        Permissão
                                    </label>


                                    <select
                                        value={memberRole}
                                        onChange={(event) =>
                                            setMemberRole(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            currentUserMember?.role !== "master" ||
                                            selectedMember.uid ===
                                            getAuth().currentUser?.uid
                                        }
                                    >

                                        <option value="master">
                                            Administrador principal
                                        </option>

                                        <option value="administrator">
                                            Administrador
                                        </option>

                                        <option value="professional">
                                            Profissional
                                        </option>

                                    </select>


                                    {selectedMember.uid ===
                                        getAuth().currentUser?.uid && (

                                            <span className="dashboard-member-role-warning">

                                                <Icon
                                                    icon="lucide:info"
                                                />

                                                Você não pode alterar sua própria função.

                                            </span>

                                        )}

                                </div>

                            </div>

                            {/* =====================================================
    ZONA DE PERIGO
===================================================== */}

                            <div className="dashboard-member-danger-zone">

                                <div className="dashboard-member-danger-content">

                                    <div className="dashboard-member-danger-icon">

                                        <Icon
                                            icon="lucide:user-minus"
                                        />

                                    </div>

                                    <div>

                                        <strong>
                                            Remover membro
                                        </strong>

                                        <p>
                                            Remove este usuário da equipe da empresa.
                                            Essa ação não pode ser desfeita.
                                        </p>

                                    </div>

                                </div>


                                <button
                                    type="button"
                                    className="dashboard-member-danger-button"
                                    onClick={
                                        openRemoveMemberConfirmation
                                    }
                                >

                                    <Icon
                                        icon="lucide:user-minus"
                                    />

                                    Remover membro

                                </button>

                            </div>
                            {/* FOOTER */}

                            <div className="dashboard-member-details-footer">

                                <button
                                    type="button"
                                    className="dashboard-member-details-cancel"
                                    onClick={closeMemberDetails}
                                >
                                    Cancelar
                                </button>


                                <button
                                    type="button"
                                    className="dashboard-member-details-save"
                                    onClick={handleChangeMemberRole}
                                    disabled={
                                        savingMemberRole ||
                                        currentUserMember?.role !== "master" ||
                                        selectedMember.uid ===
                                        getAuth().currentUser?.uid ||
                                        memberRole === selectedMember.role
                                    }
                                >

                                    {savingMemberRole ? (

                                        <>
                                            <Icon
                                                icon="lucide:loader-2"
                                                className="dashboard-member-details-loading"
                                            />

                                            Salvando...

                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="lucide:save"
                                            />

                                            Salvar alterações

                                        </>

                                    )}

                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>

            {/* =====================================================
    CONFIRMAÇÃO — REMOVER MEMBRO
===================================================== */}

            <AnimatePresence>

                {isRemoveMemberModalOpen && (

                    <motion.div
                        className="dashboard-remove-member-overlay"

                        initial={{
                            opacity: 0
                        }}

                        animate={{
                            opacity: 1
                        }}

                        exit={{
                            opacity: 0
                        }}

                        transition={{
                            duration: 0.18
                        }}

                        onClick={() =>
                            setIsRemoveMemberModalOpen(false)
                        }
                    >

                        <motion.div
                            className="dashboard-remove-member-modal"

                            initial={{
                                opacity: 0,
                                scale: 0.94,
                                y: 12
                            }}

                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: 0
                            }}

                            exit={{
                                opacity: 0,
                                scale: 0.96,
                                y: 8
                            }}

                            transition={{
                                duration: 0.22,
                                ease: [0.22, 1, 0.36, 1]
                            }}

                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >

                            {/* ÍCONE */}

                            <div className="dashboard-remove-member-icon">

                                <Icon
                                    icon="lucide:user-minus"
                                />

                            </div>


                            {/* CONTEÚDO */}

                            <div className="dashboard-remove-member-content">

                                <h2>
                                    Remover membro?
                                </h2>

                                <p>

                                    Você está prestes a remover

                                    <strong>
                                        {" "}
                                        {selectedMember?.name || "este membro"}
                                    </strong>

                                    {" "}
                                    da empresa.

                                </p>

                                <span>
                                    Essa ação não poderá ser desfeita.
                                </span>

                            </div>


                            {/* AÇÕES */}

                            <div className="dashboard-remove-member-actions">

                                <button
                                    type="button"
                                    className="dashboard-remove-member-cancel"
                                    disabled={removingMember}
                                    onClick={() =>
                                        setIsRemoveMemberModalOpen(false)
                                    }
                                >
                                    Cancelar
                                </button>


                                <button
                                    type="button"
                                    className="dashboard-remove-member-confirm"
                                    disabled={removingMember}
                                    onClick={handleRemoveMember}
                                >

                                    {removingMember ? (

                                        <>
                                            <Icon
                                                icon="lucide:loader-2"
                                                className="dashboard-remove-member-loading"
                                            />

                                            Removendo...

                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="lucide:user-minus"
                                            />

                                            Remover membro

                                        </>

                                    )}

                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>
            {/* =====================================================
                ADMIN MODAL
            ===================================================== */}

            {isAdminModalVisible && (

                <div
                    className={`
                        dashboard-admin-modal-overlay
                        ${isAdminModalOpen
                            ? "dashboard-admin-modal-overlay--open"
                            : ""
                        }
                    `}
                    onClick={
                        closeAdminModal
                    }
                >

                    <div
                        className={`
                            dashboard-admin-modal
                            ${isAdminModalOpen
                                ? "dashboard-admin-modal--open"
                                : ""
                            }
                        `}
                        onClick={
                            e =>
                                e.stopPropagation()
                        }
                    >


                        {/* HEADER */}

                        <div className="dashboard-admin-modal__header">

                            <div>

                                <span>
                                    EQUIPE
                                </span>

                                <h2>
                                    Adicionar membro
                                </h2>

                            </div>


                            <button
                                className="dashboard-admin-modal__close"
                                onClick={
                                    closeAdminModal
                                }
                            >

                                <Icon
                                    icon="mingcute:close-line"
                                    className="icon"
                                />

                            </button>

                        </div>


                        {/* SWITCH */}

                        <div className="dashboard-admin-register-switch">

                            <div
                                className={`
                                    dashboard-admin-register-switch__indicator
                                    ${adminRegisterMode ===
                                        "requests"
                                        ? "dashboard-admin-register-switch__indicator--right"
                                        : ""
                                    }
                                `}
                            />


                            <button
                                className={
                                    adminRegisterMode ===
                                        "manual"
                                        ? "dashboard-admin-register-switch__button dashboard-admin-register-switch__button--active"
                                        : "dashboard-admin-register-switch__button"
                                }
                                onClick={() =>
                                    setAdminRegisterMode(
                                        "manual"
                                    )
                                }
                            >
                                Convidar
                            </button>


                            <button
                                className={
                                    adminRegisterMode ===
                                        "requests"
                                        ? "dashboard-admin-register-switch__button dashboard-admin-register-switch__button--active"
                                        : "dashboard-admin-register-switch__button"
                                }
                                onClick={() =>
                                    setAdminRegisterMode(
                                        "requests"
                                    )
                                }
                            >
                                Pedidos
                            </button>

                        </div>


                        {/* CONTENT */}

                        <div className="dashboard-admin-modal__content">

                            {adminRegisterMode ===
                                "manual" ? (

                                <form
                                    className="dashboard-admin-form"
                                    onSubmit={
                                        handleSendInvite
                                    }
                                >

                                    <div className="dashboard-admin-form__group">

                                        <label>
                                            Nome completo
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Ex.: João da Silva"
                                            value={
                                                inviteName
                                            }
                                            onChange={
                                                e =>
                                                    setInviteName(
                                                        e.target.value
                                                    )
                                            }
                                            required
                                        />

                                    </div>


                                    <div className="dashboard-admin-form__group">

                                        <label>
                                            E-mail
                                        </label>

                                        <input
                                            type="email"
                                            placeholder="joao@email.com"
                                            value={
                                                inviteEmail
                                            }
                                            onChange={
                                                e =>
                                                    setInviteEmail(
                                                        e.target.value
                                                    )
                                            }
                                            required
                                        />

                                    </div>


                                    <div className="dashboard-admin-form__group">

                                        <label>
                                            Função
                                        </label>

                                        <select
                                            value={
                                                inviteRole
                                            }
                                            onChange={
                                                e =>
                                                    setInviteRole(
                                                        e.target.value
                                                    )
                                            }
                                        >

                                            <option value="administrator">
                                                Administrador
                                            </option>

                                            <option value="professional">
                                                Profissional
                                            </option>

                                        </select>

                                    </div>


                                    <button
                                        type="submit"
                                        className="dashboard-admin-form__submit"
                                        disabled={
                                            sendingInvite
                                        }
                                    >

                                        <Icon
                                            icon="solar:user-plus-bold"
                                            className="icon"
                                        />

                                        {
                                            sendingInvite
                                                ? "Enviando..."
                                                : "Enviar convite"
                                        }

                                    </button>

                                </form>

                            ) : (

                                <div className="dashboard-admin-requests">

                                    <Icon
                                        icon="lucide:inbox"
                                    />

                                    <strong>
                                        Nenhum pedido
                                    </strong>

                                    <span>
                                        Solicitações de entrada
                                        aparecerão aqui.
                                    </span>

                                </div>

                            )}

                        </div>

                    </div>

                </div>

            )}

            {/* =====================================================
    LOGOUT CONFIRMATION MODAL
===================================================== */}

            <AnimatePresence>

                {isLogoutModalOpen && (

                    <motion.div
                        className="dashboard-logout-overlay"

                        initial={{
                            opacity: 0
                        }}

                        animate={{
                            opacity: 1
                        }}

                        exit={{
                            opacity: 0
                        }}

                        transition={{
                            duration: 0.2
                        }}

                        onClick={() =>
                            setIsLogoutModalOpen(false)
                        }
                    >

                        <motion.div
                            className="dashboard-logout-modal"

                            initial={{
                                opacity: 0,
                                y: 18,
                                scale: 0.94
                            }}

                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1
                            }}

                            exit={{
                                opacity: 0,
                                y: 10,
                                scale: 0.96
                            }}

                            transition={{
                                duration: 0.24,
                                ease: [0.22, 1, 0.36, 1]
                            }}

                            onClick={e =>
                                e.stopPropagation()
                            }
                        >

                            {/* ÍCONE */}

                            <div className="dashboard-logout-icon">

                                <Icon
                                    icon="lucide:log-out"
                                />

                            </div>


                            {/* CONTEÚDO */}

                            <div className="dashboard-logout-content">

                                <h2>
                                    Sair da conta?
                                </h2>

                                <p>
                                    Tem certeza de que deseja
                                    encerrar sua sessão?
                                </p>

                            </div>


                            {/* AÇÕES */}

                            <div className="dashboard-logout-actions">

                                <button
                                    type="button"
                                    className="dashboard-logout-cancel"
                                    onClick={() =>
                                        setIsLogoutModalOpen(false)
                                    }
                                >
                                    Cancelar
                                </button>


                                <button
                                    type="button"
                                    className="dashboard-logout-confirm"
                                    onClick={handleLogout}
                                >

                                    <Icon
                                        icon="lucide:log-out"
                                    />

                                    Sair da conta

                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                TOAST
            ===================================================== */}

            <Toast
                show={
                    toast.show
                }

                type={
                    toast.type
                }

                title={
                    toast.title
                }

                message={
                    toast.message
                }

                onClose={() =>
                    setToast(
                        prev => ({
                            ...prev,
                            show: false
                        })
                    )
                }

            />

        </div>

    );

};


export default Dashboard;