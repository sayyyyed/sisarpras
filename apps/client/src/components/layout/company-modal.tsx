import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Modal, ModalBody, ModalDialog, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { getCompanyProfile, saveCompanyProfile, type CompanyProfile } from "@/lib/company";

export const OPEN_COMPANY_EVENT = "sisarpras:open-company-profile";

export function CompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<CompanyProfile>(() => getCompanyProfile());

  useEffect(() => {
    if (open) setProfile(getCompanyProfile());
  }, [open]);

  function update(key: keyof CompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <ModalDialog aria-label="Profil instansi">
        <ModalHeader title="Profil Instansi" description="Informasi ini ditampilkan pada menu tim." />
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Input label="Nama instansi" value={profile.name} onChange={(value) => update("name", value)} />
            <Input label="Email" type="email" value={profile.email} onChange={(value) => update("email", value)} />
            <Input label="Telepon" value={profile.phone} onChange={(value) => update("phone", value)} />
            <Input label="Alamat" value={profile.address} onChange={(value) => update("address", value)} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={() => { saveCompanyProfile(profile); onClose(); }}>Simpan Profil</Button>
        </ModalFooter>
      </ModalDialog>
    </Modal>
  );
}
