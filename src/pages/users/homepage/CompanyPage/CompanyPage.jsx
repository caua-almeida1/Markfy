import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDatabase, ref, get } from "firebase/database";
import TabBar from "../../../../components/tabbar";

import "./company-page.css"; // agora com css próprio

export default function CompanyPage() {
  const { handle } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const db = getDatabase();
        const companyRef = ref(db, `companys/${handle}`);
        const snapshot = await get(companyRef);

        if (snapshot.exists()) {
          setCompany(snapshot.val());
        } else {
          setCompany(null);
        }
      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [handle]);

  if (loading) return <p>Carregando...</p>;
  if (!company) return <p>Empresa não encontrada.</p>;

  return (
    <div className="company-page-wrapper">
      <div className="company-page-container">
        <div className="company-page-header">
          {company.logoPreview && (
            <img
              src={company.logoPreview}
              alt={company.name}
              className="company-page-logo"
            />
          )}
          <div className="company-page-info">
            <h2 className="company-page-name">{company.name}</h2>
            <p className="company-page-handle">@{company.handle}</p>
            <p className="company-page-description">{company.description}</p>
          </div>
        </div>

        <p className="company-page-contact">📧 {company.email}</p>
        <p className="company-page-contact">📞 {company.phone}</p>

        <div className="company-page-gallery">
          <div className="company-page-gallery-item"></div>
          <div className="company-page-gallery-item"></div>
          <div className="company-page-gallery-item"></div>
          <div className="company-page-gallery-item"></div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <TabBar />
        </div>
      </div>
    </div>
  );
}
